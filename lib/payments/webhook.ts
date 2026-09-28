import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLog, members } from "@/lib/db/schema";
import { getMemberBalance } from "@/lib/db/queries";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { getStripe } from "./stripe";

// What a Stripe event means for us. Pure, so the event mapping is unit tested
// without a database.
export type WebhookAction =
  | {
      kind: "credit";
      paymentId: string;
      sessionId: string;
      amountCents: number;
      currency: string;
      paymentIntentId: string | null;
    }
  | { kind: "close"; paymentId: string; sessionId: string; status: "failed" | "expired" }
  | { kind: "refund"; paymentIntentId: string; refundedCents: number }
  | { kind: "ignore" };

function idOf(ref: string | { id: string } | null): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export function planWebhookAction(event: Stripe.Event): WebhookAction {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      // Sessions this app did not create (Dashboard, payment links) carry no
      // paymentId: nothing to credit. An unpaid "completed" session is a
      // delayed method (SEPA, bank transfer): the async event follows.
      if (!paymentId || session.payment_status !== "paid") return { kind: "ignore" };
      if (session.amount_total == null || !session.currency) return { kind: "ignore" };
      return {
        kind: "credit",
        paymentId,
        sessionId: session.id,
        amountCents: session.amount_total,
        currency: session.currency,
        paymentIntentId: idOf(session.payment_intent),
      };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      if (!paymentId) return { kind: "ignore" };
      return {
        kind: "close",
        paymentId,
        sessionId: session.id,
        status: event.type === "checkout.session.expired" ? "expired" : "failed",
      };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return { kind: "ignore" };
      return { kind: "refund", paymentIntentId, refundedCents: charge.amount_refunded };
    }
    default:
      return { kind: "ignore" };
  }
}

type Db = ReturnType<typeof getDb>;
type LedgerRow = { member_id: string; amount: string; payment_id: string };

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function audit(db: Db, action: string, entityId: string, payload: unknown) {
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: "stripe",
    action,
    entityType: "payment",
    entityId,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date(),
  });
}

async function notifyMember(db: Db, memberId: string, title: string, body: (balance: string) => string) {
  const [member] = await db
    .select({ email: members.email })
    .from(members)
    .where(eq(members.memberId, memberId))
    .limit(1);
  const balance = await getMemberBalance(memberId);
  await dispatchNotification(db, {
    memberId,
    memberEmail: member?.email ?? null,
    type: "topup_received",
    title,
    body: body(formatMoney(balance)),
    href: "/storico",
    createdAt: new Date(),
  });
}

// Stripe does not order events: a refund can arrive while the credit is still
// being retried, when the payment row has no payment_intent_id yet. Answering
// 200 would drop the refund forever, so throw (-> 500, Stripe retries later)
// when the intent belongs to one of our payments that is still pending.
async function ensureRefundNotEarly(db: Db, paymentIntentId: string): Promise<void> {
  const { rows } = await db.execute<{ one: number }>(
    sql`SELECT 1 AS one FROM payments WHERE payment_intent_id = ${paymentIntentId}`,
  );
  if (rows.length > 0) return; // known payment: this refund was already posted
  const intent = await getStripe()?.paymentIntents.retrieve(paymentIntentId);
  const paymentId = intent?.metadata?.paymentId;
  if (!paymentId) return; // not a top-up of this app
  const { rows: pending } = await db.execute<{ one: number }>(
    sql`SELECT 1 AS one FROM payments WHERE payment_id = ${paymentId} AND status = 'pending'`,
  );
  if (pending.length > 0) throw new Error(`refund for ${paymentId} arrived before its credit`);
}

// Each branch is ONE SQL statement, hence one transaction: the guarded UPDATE
// on payments and the ledger INSERT happen together or not at all. A replayed
// or late event finds the payment already past the guarded status and writes
// nothing (and the partial unique index on ledger_entries.payment_id would
// reject a second credit anyway).
export async function applyWebhookAction(action: WebhookAction): Promise<void> {
  if (action.kind === "ignore") return;
  const db = getDb();

  if (action.kind === "credit") {
    const entryId = genId("led");
    const { rows } = await db.execute<LedgerRow>(sql`
      WITH upd AS (
        UPDATE payments
        SET status = 'succeeded',
            checkout_session_id = ${action.sessionId},
            payment_intent_id = coalesce(${action.paymentIntentId}, payment_intent_id),
            updated_at = now()
        WHERE payment_id = ${action.paymentId}
          AND status = 'pending'
          AND (checkout_session_id IS NULL OR checkout_session_id = ${action.sessionId})
          AND amount_cents = ${action.amountCents}
          AND currency = ${action.currency}
        RETURNING payment_id, member_id, amount_cents
      )
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
      SELECT ${entryId}, member_id, now(), 'topup', amount_cents::numeric / 100, NULL,
             ${t.topup.ledgerNote}, 'stripe', now(), payment_id
      FROM upd
      RETURNING member_id, amount::text AS amount, payment_id
    `);
    const credited = rows[0];
    if (!credited) {
      // Already credited (replay), or the event does not match what we asked
      // Stripe to charge. Only the second one needs a human.
      const { rows: existing } = await db.execute<{ status: string; amount_cents: number; currency: string }>(
        sql`SELECT status, amount_cents, currency FROM payments WHERE payment_id = ${action.paymentId}`,
      );
      if (existing[0]?.status === "pending") {
        console.error("[stripe] paid session does not match its payment row", { action, row: existing[0] });
        await audit(db, "stripe_topup_mismatch", action.paymentId, { action, row: existing[0] });
      }
      return;
    }
    await audit(db, "stripe_topup", action.paymentId, credited);
    const amount = formatMoney(parseFloat(credited.amount));
    await notifyMember(db, credited.member_id, t.notificationsServer.onlineTopupTitle, (balance) =>
      t.notificationsServer.onlineTopupBody(amount, balance),
    );
    return;
  }

  if (action.kind === "close") {
    await db.execute(sql`
      UPDATE payments
      SET status = ${action.status}, checkout_session_id = ${action.sessionId}, updated_at = now()
      WHERE payment_id = ${action.paymentId} AND status = 'pending'
    `);
    return;
  }

  // Refund: charge.amount_refunded is cumulative, so post only the delta since
  // the last refund we saw. FOR UPDATE serialises two refund events for the
  // same payment; the second then sees the first one's refunded_cents.
  const entryId = genId("led");
  const { rows } = await db.execute<LedgerRow>(sql`
    WITH prev AS (
      SELECT payment_id, refunded_cents
      FROM payments
      WHERE payment_intent_id = ${action.paymentIntentId}
        AND status IN ('succeeded', 'partially_refunded')
      FOR UPDATE
    ),
    upd AS (
      UPDATE payments p
      SET refunded_cents = ${action.refundedCents},
          status = CASE WHEN ${action.refundedCents} >= p.amount_cents THEN 'refunded' ELSE 'partially_refunded' END,
          updated_at = now()
      FROM prev
      WHERE p.payment_id = prev.payment_id AND prev.refunded_cents < ${action.refundedCents}
      RETURNING p.payment_id, p.member_id, ${action.refundedCents} - prev.refunded_cents AS delta_cents
    )
    INSERT INTO ledger_entries
      (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
    SELECT ${entryId}, member_id, now(), 'correction', -(delta_cents::numeric / 100), NULL,
           ${t.topup.refundLedgerNote}, 'stripe', now(), payment_id
    FROM upd
    RETURNING member_id, amount::text AS amount, payment_id
  `);
  const refunded = rows[0];
  if (!refunded) {
    await ensureRefundNotEarly(db, action.paymentIntentId);
    return;
  }
  await audit(db, "stripe_refund", refunded.payment_id, refunded);
  const amount = formatMoney(Math.abs(parseFloat(refunded.amount)));
  await notifyMember(db, refunded.member_id, t.notificationsServer.onlineRefundTitle, (balance) =>
    t.notificationsServer.onlineRefundBody(amount, balance),
  );
}

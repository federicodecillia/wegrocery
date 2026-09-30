import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { dispatchToMembers } from "@/lib/notifications/dispatch";
import { selectCycleAccessMembers } from "@/lib/notifications/reminder";
import { audit, genId, notifyMember, type Db } from "./effects";
import {
  planRefundTransition,
  refundedCentsDelta,
  refundInputOf,
  refundLedgerRow,
  refundNoteKind,
  type RefundNoteKind,
  type RefundStatus,
  type RefundTransition,
  type StripeRefundInput,
} from "./refunds";
import { getStripe } from "./stripe";

type RefundRow = {
  refund_id: string;
  payment_id: string;
  member_id: string;
  cycle_id: string | null;
  status: RefundStatus;
  reason: string;
};

// The refund row an event is about: by Stripe id, then by the id the app put
// in the metadata, then an imported pre-1.15.0 row of the same payment and
// amount that Stripe had not named yet (adopted here: its Stripe id is set).
// Only a refund Stripe made before the import can be an imported one, and
// SKIP LOCKED gives two concurrent events two different rows.
async function findRefund(db: Db, input: StripeRefundInput): Promise<RefundRow | null> {
  const byAppId = input.appRefundId ? sql` OR refund_id = ${input.appRefundId}` : sql``;
  const { rows } = await db.execute<RefundRow>(sql`
    SELECT refund_id, payment_id, member_id, cycle_id, status, reason
    FROM refunds
    WHERE stripe_refund_id = ${input.stripeRefundId}${byAppId}
    ORDER BY stripe_refund_id IS NULL
    LIMIT 1
  `);
  if (rows[0]) return rows[0];
  const { rows: adopted } = await db.execute<RefundRow>(sql`
    UPDATE refunds
    SET stripe_refund_id = ${input.stripeRefundId}, updated_at = now()
    WHERE refund_id = (
      SELECT r.refund_id
      FROM refunds r
      JOIN payments p ON p.payment_id = r.payment_id
      WHERE p.payment_intent_id = ${input.paymentIntentId}
        AND r.created_by = 'import'
        AND r.stripe_refund_id IS NULL
        AND r.amount_cents = ${input.amountCents}
        AND r.created_at >= to_timestamp(${input.createdAt})
      ORDER BY r.created_at, r.refund_id
      LIMIT 1
      FOR UPDATE OF r SKIP LOCKED
    )
      AND stripe_refund_id IS NULL
    RETURNING refund_id, payment_id, member_id, cycle_id, status, reason
  `);
  return adopted[0] ?? null;
}

async function findPayment(
  db: Db,
  paymentIntentId: string,
): Promise<{ payment_id: string; member_id: string } | null> {
  const { rows } = await db.execute<{ payment_id: string; member_id: string }>(
    sql`SELECT payment_id, member_id FROM payments WHERE payment_intent_id = ${paymentIntentId}`,
  );
  return rows[0] ?? null;
}

// Stripe does not order events: a refund can arrive while the credit is still
// being retried, when the payment row has no payment_intent_id yet. Answering
// 200 would drop the refund forever, so throw (-> 500, Stripe retries later)
// when the intent belongs to one of our payments that is still pending.
async function ensureRefundNotEarly(db: Db, paymentIntentId: string): Promise<void> {
  const intent = await getStripe()?.paymentIntents.retrieve(paymentIntentId);
  const paymentId = intent?.metadata?.paymentId;
  if (!paymentId) return; // not a payment of this app
  const { rows } = await db.execute<{ one: number }>(
    sql`SELECT 1 AS one FROM payments WHERE payment_id = ${paymentId} AND status = 'pending'`,
  );
  if (rows.length > 0) throw new Error(`refund for ${paymentId} arrived before its credit`);
}

// ONE statement: the guarded write of the refund row, then its ledger row and
// the payment's refunded_cents, which move only when the ledger row is new.
// null = another event for the same refund changed it first.
async function writeTransition(
  db: Db,
  row: RefundRow,
  isNew: boolean,
  input: StripeRefundInput,
  plan: RefundTransition,
): Promise<{ posted: boolean } | null> {
  // A refund first seen on Stripe is born in its state: never 'requested',
  // which from B2.2 means "the app asked, Stripe has not answered".
  const head = isNew
    ? sql`
        INSERT INTO refunds
          (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
           stripe_refund_id, created_by, created_at, updated_at)
        VALUES (${row.refund_id}, ${row.payment_id}, ${row.member_id}, NULL, ${input.amountCents},
                ${plan.status}, 'dashboard', ${input.stripeRefundId}, 'stripe', now(), now())
        ON CONFLICT DO NOTHING
        RETURNING refund_id, payment_id, member_id, cycle_id`
    : sql`
        UPDATE refunds
        SET status = ${plan.status},
            amount_cents = ${input.amountCents},
            stripe_refund_id = ${input.stripeRefundId},
            updated_at = now()
        WHERE refund_id = ${row.refund_id} AND status = ${row.status}
        RETURNING refund_id, payment_id, member_id, cycle_id`;

  if (plan.movement === null) {
    const { rows } = await db.execute(head);
    return rows.length > 0 ? { posted: false } : null;
  }

  const ledger = refundLedgerRow(row.cycle_id, input.amountCents, plan.movement);
  const delta = refundedCentsDelta(plan.movement, input.amountCents);
  const note = REFUND_NOTES[refundNoteKind(row.cycle_id, row.reason, plan.movement)]();
  const { rows } = await db.execute<{ posted: number }>(sql`
    WITH r AS (${head}),
    led AS (
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at,
         payment_id, refund_id)
      SELECT ${genId("led")}, member_id, now(), ${ledger.type}, ${ledger.amountCents}::numeric / 100,
             cycle_id, ${note}, 'stripe', now(), payment_id, refund_id
      FROM r
      ON CONFLICT DO NOTHING
      RETURNING payment_id
    ),
    pay AS (
      UPDATE payments p
      SET refunded_cents = p.refunded_cents + ${delta},
          status = CASE
            WHEN p.refunded_cents + ${delta} >= p.amount_cents THEN 'refunded'
            WHEN p.refunded_cents + ${delta} > 0 THEN 'partially_refunded'
            ELSE 'succeeded'
          END,
          updated_at = now()
      FROM led
      WHERE p.payment_id = led.payment_id
      RETURNING p.payment_id
    )
    SELECT (SELECT count(*) FROM led)::int AS posted FROM r
  `);
  const written = rows[0];
  return written ? { posted: written.posted > 0 } : null;
}

const REFUND_NOTES: Record<RefundNoteKind, () => string> = {
  topup: () => t.topup.refundLedgerNote,
  failed: () => t.topup.refundFailedLedgerNote,
  order: () => t.ledger.orderRefund,
  orderCancelled: () => t.ledger.orderRefundCancelled,
  latePayment: () => t.ledger.orderRefundLate,
};

// Every active admin (the audience of an admin-only cycle) is told about a
// refund that needs a person: `body` gets the member's name.
export async function notifyAdminsOfRefund(
  db: Db,
  memberId: string,
  title: string,
  body: (memberName: string) => string,
): Promise<void> {
  const rows = await db
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      email: members.email,
      role: members.role,
      active: members.active,
    })
    .from(members);
  const name = rows.find((m) => m.memberId === memberId)?.fullName ?? memberId;
  const admins = selectCycleAccessMembers(rows, "admin");
  await dispatchToMembers(
    db,
    admins.map((a) => ({ memberId: a.memberId, email: a.email })),
    { type: "refund_failed", title, body: body(name), href: "/admin?tab=cassa" },
  );
}

async function afterTransition(
  db: Db,
  row: RefundRow,
  input: StripeRefundInput,
  plan: RefundTransition,
  posted: boolean,
): Promise<void> {
  const reversed = posted && plan.movement === "reversal";
  await audit(db, reversed ? "stripe_refund_failed" : "stripe_refund", row.payment_id, {
    refundId: row.refund_id,
    stripeRefundId: input.stripeRefundId,
    status: plan.status,
    amountCents: input.amountCents,
    movement: posted ? plan.movement : null,
  });
  if (!posted) return;
  const amount = formatMoney(input.amountCents / 100);
  if (plan.movement === "debit" && row.cycle_id === null) {
    await notifyMember(db, row.member_id, "topup_received", t.notificationsServer.onlineRefundTitle, (balance) =>
      t.notificationsServer.onlineRefundBody(amount, balance),
    );
  }
  if (plan.movement === "debit" && row.cycle_id !== null) {
    const body =
      row.reason === "order_cancelled"
        ? t.notificationsServer.orderRefundCancelledBody(amount)
        : row.reason === "late_payment"
          ? t.notificationsServer.orderRefundLateBody(amount)
          : t.notificationsServer.orderRefundBody(amount);
    await notifyMember(db, row.member_id, "order_refund_sent", t.notificationsServer.orderRefundTitle, () => body);
  }
  if (reversed) {
    await notifyMember(db, row.member_id, "refund_failed", t.notificationsServer.refundFailedTitle, (balance) =>
      t.notificationsServer.refundFailedBody(amount, balance),
    );
    await notifyAdminsOfRefund(db, row.member_id, t.notificationsServer.refundFailedTitle, (name) =>
      t.notificationsServer.refundFailedAdminBody(amount, name),
    );
  }
}

// Records a Stripe refund, whichever source reports it (refund.* events,
// charge.refunded, from B2.2 the API response). Idempotent: the same or an
// older state changes nothing. Throws, so the webhook answers 500 and Stripe
// retries, when the refund's payment is still waiting for its credit or the
// row keeps changing under it.
export async function upsertStripeRefund(input: StripeRefundInput): Promise<void> {
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await findRefund(db, input);
    let row = found;
    if (!row) {
      const payment = await findPayment(db, input.paymentIntentId);
      if (!payment) {
        await ensureRefundNotEarly(db, input.paymentIntentId);
        return; // a charge this app did not create
      }
      row = {
        refund_id: `ref_${input.stripeRefundId}`,
        payment_id: payment.payment_id,
        member_id: payment.member_id,
        cycle_id: null,
        status: "requested",
        reason: "dashboard",
      };
    }
    const plan = planRefundTransition(row.status, input.status);
    if (!plan) return;
    const written = await writeTransition(db, row, found === null, input, plan);
    if (written) {
      // The movement is committed. A failure here must not answer 500: Stripe
      // would retry an event that has nothing left to write, and the notices
      // would be lost anyway.
      try {
        await afterTransition(db, row, input, plan, written.posted);
      } catch (e) {
        reportError("stripe refund notices", e, { refundId: row.refund_id, paymentId: row.payment_id });
      }
      return;
    }
    // Another event for the same refund got there first: read it again.
  }
  throw new Error(`refund ${input.stripeRefundId} kept changing while being recorded`);
}

// charge.refunded: read every refund of the charge again, oldest first. The
// safety net for refund.* events that never arrived or are not subscribed.
export async function syncChargeRefunds(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const { data } = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  for (const refund of [...data].sort((a, b) => a.created - b.created)) {
    const input = refundInputOf(refund);
    if (input) await upsertStripeRefund(input);
  }
}

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { sameOrderLines } from "@/lib/order-draft";
import { audit, genId, notifyMember, type Db } from "./effects";
import type { OrderSnapshot } from "./order-payment";
import { sendRequestedRefund, type RefundApi } from "./refund-request";
import { getStripe } from "./stripe";

// A paid Checkout Session of an order payment (payments.kind = 'order').
export type OrderCreditAction = {
  kind: "order_credit";
  paymentId: string;
  cycleId: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string | null;
};

// The snapshot's lines as rows. Column names are the JSON keys.
const snapshotLines = sql`jsonb_to_recordset(p.order_snapshot->'lines')
  AS l("productId" text, quantity integer, "unitPriceCents" integer)`;

function isGuardError(e: unknown): boolean {
  return e instanceof Error && /22012|division by zero/i.test(e.message);
}

// The payment becomes the member's order: ONE transaction (db.batch) that
// locks the cycle like saveOrder and the close do, checks that the payment is
// the pending one the app created and that the cycle can still take the
// order, replaces the member's lines with the paid snapshot, and credits the
// payment on the cycle. A guard that fails rolls everything back (22012).
async function creditBatch(db: Db, a: OrderCreditAction): Promise<boolean> {
  const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${a.cycleId} FOR UPDATE`);
  const guard = db.execute(sql`
    SELECT 1 / (CASE WHEN
      (SELECT status FROM order_cycles WHERE cycle_id = ${a.cycleId}) = 'open'
      AND EXISTS (
        SELECT 1 FROM payments
        WHERE payment_id = ${a.paymentId} AND status = 'pending' AND kind = 'order' AND cycle_id = ${a.cycleId}
          AND amount_cents = ${a.amountCents} AND currency = ${a.currency}
          AND (checkout_session_id IS NULL OR checkout_session_id = ${a.sessionId})
      )
      AND NOT EXISTS (
        SELECT 1 FROM payments p, ${snapshotLines}
        WHERE p.payment_id = ${a.paymentId}
          AND NOT EXISTS (
            SELECT 1 FROM products pr
            WHERE pr.product_id = l."productId" AND pr.cycle_id = ${a.cycleId} AND pr.active
          )
      )
    THEN 1 ELSE 0 END) AS credit_guard
  `);
  const deleteOrder = db.execute(sql`
    DELETE FROM orders
    WHERE cycle_id = ${a.cycleId}
      AND member_id = (SELECT member_id FROM payments WHERE payment_id = ${a.paymentId})
  `);
  const insertOrder = db.execute(sql`
    INSERT INTO orders
      (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
    SELECT gen_random_uuid()::text, ${a.cycleId}, p.member_id, l."productId", l.quantity,
           l."unitPriceCents"::numeric / 100, (l."unitPriceCents" * l.quantity)::numeric / 100, now()
    FROM payments p, ${snapshotLines}
    WHERE p.payment_id = ${a.paymentId} AND l.quantity > 0
  `);
  const credit = db.execute(sql`
    WITH upd AS (
      UPDATE payments
      SET status = 'succeeded',
          checkout_session_id = ${a.sessionId},
          payment_intent_id = coalesce(${a.paymentIntentId}, payment_intent_id),
          updated_at = now()
      WHERE payment_id = ${a.paymentId} AND status = 'pending'
      RETURNING payment_id, member_id, amount_cents
    )
    INSERT INTO ledger_entries
      (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
    SELECT ${genId("led")}, member_id, now(), 'order_payment', amount_cents::numeric / 100, ${a.cycleId},
           ${t.ledger.orderPayment}, 'stripe', now(), payment_id
    FROM upd
  `);
  try {
    await db.batch([lock, guard, deleteOrder, insertOrder, credit]);
    return true;
  } catch (e) {
    if (isGuardError(e)) return false;
    throw e;
  }
}

type PaymentRow = {
  member_id: string;
  status: string;
  kind: string;
  cycle_id: string | null;
  amount_cents: number;
  currency: string;
  checkout_session_id: string | null;
  order_snapshot: OrderSnapshot | null;
};

async function readPayment(db: Db, paymentId: string): Promise<PaymentRow | null> {
  const { rows } = await db.execute<PaymentRow>(sql`
    SELECT member_id, status, kind, cycle_id, amount_cents, currency, checkout_session_id, order_snapshot
    FROM payments WHERE payment_id = ${paymentId}
  `);
  return rows[0] ?? null;
}

// The money arrived but the order cannot exist (the cycle closed, or a paid
// product left it): ONE statement credits the payment on the cycle and asks
// for its full refund, so the cycle's net for the member goes back to zero.
async function creditLate(db: Db, a: OrderCreditAction): Promise<string | null> {
  const { rows } = await db.execute<{ refund_id: string }>(sql`
    WITH upd AS (
      UPDATE payments
      SET status = 'succeeded',
          checkout_session_id = ${a.sessionId},
          payment_intent_id = coalesce(${a.paymentIntentId}, payment_intent_id),
          updated_at = now()
      WHERE payment_id = ${a.paymentId} AND status = 'pending'
      RETURNING payment_id, member_id, amount_cents
    ),
    led AS (
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
      SELECT ${genId("led")}, member_id, now(), 'order_payment', amount_cents::numeric / 100, ${a.cycleId},
             ${t.ledger.orderPayment}, 'stripe', now(), payment_id
      FROM upd
    )
    INSERT INTO refunds
      (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason, stripe_refund_id,
       created_by, created_at, updated_at)
    SELECT 'late_' || payment_id, payment_id, member_id, ${a.cycleId}, amount_cents, 'requested',
           'late_payment', NULL, 'system', now(), now()
    FROM upd
    ON CONFLICT DO NOTHING
    RETURNING refund_id
  `);
  return rows[0]?.refund_id ?? null;
}

async function afterCredit(db: Db, a: OrderCreditAction, payment: PaymentRow): Promise<void> {
  // The draft the member paid from is done; a different one (edited during
  // the checkout) stays as unconfirmed changes.
  const paid = payment.order_snapshot?.lines ?? [];
  const { rows: drafts } = await db.execute<{ lines: { productId: string; quantity: number }[] }>(
    sql`SELECT lines FROM order_drafts WHERE member_id = ${payment.member_id} AND cycle_id = ${a.cycleId}`,
  );
  if (drafts[0] && sameOrderLines(drafts[0].lines, paid)) {
    await db.execute(
      sql`DELETE FROM order_drafts WHERE member_id = ${payment.member_id} AND cycle_id = ${a.cycleId}`,
    );
  }
  await audit(db, "stripe_order_payment", a.paymentId, { cycleId: a.cycleId, amountCents: a.amountCents });
  const { rows: cycles } = await db.execute<{ title: string }>(
    sql`SELECT title FROM order_cycles WHERE cycle_id = ${a.cycleId}`,
  );
  const s = payment.order_snapshot;
  const amount = formatMoney(a.amountCents / 100);
  const title = cycles[0]?.title ?? "";
  const body =
    s && typeof s.productsCents === "number"
      ? t.notificationsServer.orderPaidBody(
          title,
          amount,
          formatMoney(s.productsCents / 100),
          formatMoney(s.shippingCents / 100),
          formatMoney(s.feeCents / 100),
        )
      : t.notificationsServer.orderPaidShortBody(title, amount);
  await notifyMember(
    db,
    payment.member_id,
    "order_paid",
    t.notificationsServer.orderPaidTitle,
    () => body,
    `/ordine?cycleId=${a.cycleId}`,
  );
}

export async function applyOrderCredit(a: OrderCreditAction, stripe: RefundApi | null = getStripe()): Promise<void> {
  const db = getDb();
  const before = await readPayment(db, a.paymentId);
  if (!before || before.kind !== "order" || before.cycle_id !== a.cycleId) {
    // Not an order payment of this app's database: nothing to credit.
    reportError("stripe order payment", new Error("paid session without its order payment row"), {
      paymentId: a.paymentId,
    });
    return;
  }

  if (await creditBatch(db, a)) {
    try {
      await afterCredit(db, a, before);
    } catch (e) {
      // The order and the credit are committed: never answer 500 for a notice.
      reportError("stripe order payment notices", e, { paymentId: a.paymentId });
    }
    return;
  }

  // The guard fired. Why?
  const row = await readPayment(db, a.paymentId);
  if (!row || row.status !== "pending") return; // already handled: a replayed event
  const matches =
    row.amount_cents === a.amountCents &&
    row.currency === a.currency &&
    (row.checkout_session_id === null || row.checkout_session_id === a.sessionId);
  if (!matches) {
    reportError("stripe order payment", new Error("paid session does not match its payment row"), {
      paymentId: a.paymentId,
    });
    await audit(db, "stripe_order_mismatch", a.paymentId, {
      paid: { amountCents: a.amountCents, currency: a.currency, sessionId: a.sessionId },
      expected: { amountCents: row.amount_cents, currency: row.currency },
    });
    return;
  }
  const { rows: blockers } = await db.execute<{ cycle_open: boolean; missing: number }>(sql`
    SELECT
      (SELECT status FROM order_cycles WHERE cycle_id = ${a.cycleId}) = 'open' AS cycle_open,
      (SELECT count(*)::int FROM payments p, ${snapshotLines}
       WHERE p.payment_id = ${a.paymentId}
         AND NOT EXISTS (
           SELECT 1 FROM products pr
           WHERE pr.product_id = l."productId" AND pr.cycle_id = ${a.cycleId} AND pr.active
         )) AS missing
  `);
  const blocker = blockers[0];
  if (blocker?.cycle_open && blocker.missing === 0) {
    // Nothing explains the refusal: let Stripe deliver the event again.
    throw new Error(`order payment ${a.paymentId} could not be credited`);
  }

  const refundId = await creditLate(db, a);
  if (!refundId) return; // a concurrent delivery took it
  await audit(db, "stripe_order_payment_late", a.paymentId, {
    cycleId: a.cycleId,
    amountCents: a.amountCents,
    cycleOpen: blocker?.cycle_open ?? false,
    missingProducts: blocker?.missing ?? 0,
  });
  try {
    // "retry" leaves the refund requested: Cassa shows it and sends it again.
    await sendRequestedRefund(refundId, stripe);
  } catch (e) {
    reportError("stripe late payment refund", e, { paymentId: a.paymentId, refundId });
  }
}

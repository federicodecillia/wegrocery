import { sql, type SQL } from "drizzle-orm";
import type { Db } from "./effects";

// The database side of what a member does in pay-per-order: read what the
// cycle's payments cover, confirm an order that needs no payment, cancel.
// lib/actions/order-payment.ts does the checks and the Stripe calls around
// these writes; lib/payments/order-payment.ts has the arithmetic.

// Paid for the cycle and not given back, in cents: the cycle's payment and
// refund ledger rows, minus the refunds asked for and not yet in the ledger
// (their money is on its way back and must not confirm a new order).
function coverageSql(memberId: string, cycleId: string): SQL {
  return sql`(
    (SELECT coalesce(round(sum(amount) * 100), 0)::integer FROM ledger_entries
     WHERE member_id = ${memberId} AND cycle_id = ${cycleId}
       AND type IN ('order_payment', 'balance_payment', 'order_refund', 'refund_failed'))
    - (SELECT coalesce(sum(amount_cents), 0)::integer FROM refunds
       WHERE member_id = ${memberId} AND cycle_id = ${cycleId} AND status = 'requested')
  )`;
}

export async function getCycleCoverageCents(db: Db, memberId: string, cycleId: string): Promise<number> {
  const { rows } = await db.execute<{ covered: number }>(sql`SELECT ${coverageSql(memberId, cycleId)} AS covered`);
  return rows[0]?.covered ?? 0;
}

// These writes belong to pay-per-order cycles only: a wallet cycle's order is
// saveOrder's, and an unknown cycle is refused like a closed one.
function openPerOrderCycle(cycleId: string): SQL {
  return sql`coalesce((SELECT status = 'open' AND payment_mode = 'per_order' FROM order_cycles
    WHERE cycle_id = ${cycleId}), false)`;
}

function isGuardError(e: unknown): boolean {
  return e instanceof Error && /22012|division by zero/i.test(e.message);
}

export type ConfirmLine = { productId: string; quantity: number; unitPrice: string };

// Replaces the member's order with `lines` when what they already paid covers
// it. ONE transaction, like saveOrder: the cycle is row-locked and must still
// be open, and the coverage must still be what the amount was computed from
// (a refund asked for in the meantime would make the order unpaid).
// "changed" = the guard fired and nothing was written: the caller recomputes.
export async function confirmOrderWithoutPayment(
  db: Db,
  input: { memberId: string; cycleId: string; lines: ConfirmLine[]; expectedCoveredCents: number },
): Promise<"confirmed" | "changed"> {
  const { memberId, cycleId } = input;
  const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`);
  const guard = db.execute(sql`
    SELECT 1 / (CASE WHEN
      ${openPerOrderCycle(cycleId)}
      AND ${coverageSql(memberId, cycleId)} = ${input.expectedCoveredCents}
    THEN 1 ELSE 0 END) AS confirm_guard
  `);
  const deleteOrder = db.execute(sql`DELETE FROM orders WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  const lines = input.lines.filter((l) => l.quantity > 0);
  const insertOrder = db.execute(sql`
    INSERT INTO orders
      (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
    SELECT gen_random_uuid()::text, ${cycleId}, ${memberId}, l."productId", l.quantity,
           l."unitPrice"::numeric, round(l."unitPrice"::numeric * l.quantity, 2), now()
    FROM jsonb_to_recordset(${JSON.stringify(lines)}::jsonb)
      AS l("productId" text, quantity integer, "unitPrice" text)
  `);
  const deleteDraft = db.execute(sql`DELETE FROM order_drafts WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  try {
    await db.batch([lock, guard, deleteOrder, insertOrder, deleteDraft]);
    return "confirmed";
  } catch (e) {
    if (isGuardError(e)) return "changed";
    throw e;
  }
}

// Cancels the member's order on an open cycle: the lines and the draft go,
// and every paid payment of the cycle gets a refund request for what is left
// of it (paid, minus refunded, minus already requested), so cancelling twice
// asks for nothing twice. The id counts the payment's cancel refunds
// (cancel_<paymentId>_<n>): one Stripe rejected, or one reversed after being
// paid, can be asked for again. The cycle lock keeps the count stable. The caller then sends each request to Stripe (sendRequestedRefund).
export async function cancelOrderWrite(
  db: Db,
  memberId: string,
  cycleId: string,
): Promise<{ status: "cancelled"; refundIds: string[] } | { status: "cycle_not_open" }> {
  const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`);
  const guard = db.execute(sql`
    SELECT 1 / (CASE WHEN ${openPerOrderCycle(cycleId)} THEN 1 ELSE 0 END) AS cancel_guard
  `);
  const deleteOrder = db.execute(sql`DELETE FROM orders WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  const deleteDraft = db.execute(sql`DELETE FROM order_drafts WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  const requestRefunds = db.execute<{ refund_id: string }>(sql`
    INSERT INTO refunds
      (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason, stripe_refund_id,
       created_by, created_at, updated_at)
    SELECT 'cancel_' || p.payment_id || '_' || (
             SELECT count(*) + 1 FROM refunds r0
             WHERE r0.payment_id = p.payment_id AND r0.reason = 'order_cancelled'
           ), p.payment_id, p.member_id, p.cycle_id, left_cents.amount, 'requested',
           'order_cancelled', NULL, 'system', now(), now()
    FROM payments p
    CROSS JOIN LATERAL (
      SELECT p.amount_cents - p.refunded_cents - coalesce((
        SELECT sum(r.amount_cents) FROM refunds r
        WHERE r.payment_id = p.payment_id AND r.status = 'requested'
      ), 0)::integer AS amount
    ) left_cents
    WHERE p.member_id = ${memberId} AND p.cycle_id = ${cycleId} AND p.kind = 'order'
      AND p.status IN ('succeeded', 'partially_refunded')
      AND left_cents.amount > 0
    ON CONFLICT DO NOTHING
    RETURNING refund_id
  `);
  try {
    const results = await db.batch([lock, guard, deleteOrder, deleteDraft, requestRefunds]);
    const refundIds = results[4].rows.map((r) => r.refund_id).sort();
    return { status: "cancelled", refundIds };
  } catch (e) {
    if (isGuardError(e)) return { status: "cycle_not_open" };
    throw e;
  }
}

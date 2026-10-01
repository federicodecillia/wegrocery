import { sql, type SQL } from "drizzle-orm";

// One definition, shared by the settlement status, the consolidated balance,
// the mode switch and the nightly check, of "a settlement still has to send
// money back to this member's card on this cycle". Plain SQL only, so the
// invariants script can import it.

// The member's cycle net minus the refunds asked for and not yet in the
// ledger, in cents.
export function cycleLeftoverCentsSql(member: SQL, cycle: SQL): SQL {
  return sql`(
    coalesce((SELECT round(sum(l2.amount) * 100) FROM ledger_entries l2
              WHERE l2.member_id = ${member} AND l2.cycle_id = ${cycle}), 0)
    - coalesce((SELECT sum(r2.amount_cents) FROM refunds r2
                WHERE r2.member_id = ${member} AND r2.cycle_id = ${cycle} AND r2.status = 'requested'), 0))`;
}

// What the member's card payments on the cycle can still give back: paid,
// minus refunded, minus asked for. A payment whose refund failed is left out:
// that money goes back by bank transfer from Cassa, never to the card again.
export function cardRefundableCentsSql(member: SQL, cycle: SQL): SQL {
  return sql`coalesce((
    SELECT sum(p2.amount_cents - p2.refunded_cents - coalesce((
      SELECT sum(r3.amount_cents) FROM refunds r3 WHERE r3.payment_id = p2.payment_id AND r3.status = 'requested'), 0))
    FROM payments p2
    WHERE p2.cycle_id = ${cycle} AND p2.member_id = ${member} AND p2.kind = 'order'
      AND p2.status IN ('succeeded', 'partially_refunded')
      AND NOT EXISTS (SELECT 1 FROM refunds r4 WHERE r4.payment_id = p2.payment_id AND r4.status = 'failed')), 0)`;
}

// True when a settlement run would still refund the member's card.
export function owedBackToCardSql(member: SQL, cycle: SQL): SQL {
  return sql`(${cycleLeftoverCentsSql(member, cycle)} > 0 AND ${cardRefundableCentsSql(member, cycle)} > 0)`;
}

// True when the per_order cycle is not settled for this member: never
// settled, or settled and still owing money back to the card.
export function unsettledForMemberSql(member: SQL, cycle: SQL): SQL {
  return sql`EXISTS (
    SELECT 1 FROM order_cycles c2
    WHERE c2.cycle_id = ${cycle} AND c2.payment_mode = 'per_order'
      AND (c2.settled_at IS NULL OR ${owedBackToCardSql(member, cycle)}))`;
}

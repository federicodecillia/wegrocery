import { sql, type SQL } from "drizzle-orm";

// Money invariants every installation must keep, checked read-only every
// night after the backup (scripts/check-invariants.mts) and in the
// integration tests. Each check returns the ids that break it, never member
// data. An empty result everywhere = the books add up.

export type InvariantCheck = { name: string; description: string; query: SQL };

export const INVARIANT_CHECKS: InvariantCheck[] = [
  {
    name: "payment_refunded_cents",
    description: "payments.refunded_cents equals the sum of its pending or succeeded refunds",
    query: sql`
      SELECT p.payment_id AS id FROM payments p
      LEFT JOIN refunds r ON r.payment_id = p.payment_id AND r.status IN ('pending', 'succeeded')
      GROUP BY p.payment_id, p.refunded_cents
      HAVING p.refunded_cents <> coalesce(sum(r.amount_cents), 0)`,
  },
  {
    name: "refund_debit",
    description: "every refund Stripe accepted has its debit in the ledger",
    query: sql`
      SELECT r.refund_id AS id FROM refunds r
      WHERE r.status IN ('pending', 'succeeded')
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries l
          WHERE l.refund_id = r.refund_id AND l.type IN ('correction', 'order_refund')
        )`,
  },
  {
    name: "refund_reversal",
    description: "a debited refund that failed later has its refund_failed reversal",
    query: sql`
      SELECT r.refund_id AS id FROM refunds r
      WHERE r.status IN ('failed', 'canceled')
        AND EXISTS (SELECT 1 FROM ledger_entries l WHERE l.refund_id = r.refund_id AND l.type IN ('correction', 'order_refund'))
        AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.refund_id = r.refund_id AND l.type = 'refund_failed')`,
  },
  {
    name: "requested_refund_movement",
    description: "a refund Stripe has not answered moved no money",
    query: sql`
      SELECT DISTINCT r.refund_id AS id FROM refunds r
      JOIN ledger_entries l ON l.refund_id = r.refund_id
      WHERE r.status = 'requested'`,
  },
  {
    name: "paid_payment_credit",
    description: "every paid payment is credited exactly once (top-up or order payment)",
    query: sql`
      SELECT p.payment_id AS id FROM payments p
      WHERE p.status IN ('succeeded', 'partially_refunded', 'refunded')
        AND (
          SELECT count(*) FROM ledger_entries l
          WHERE l.payment_id = p.payment_id
            AND l.type = CASE p.kind WHEN 'order' THEN 'order_payment' WHEN 'balance' THEN 'balance_payment' ELSE 'topup' END
        ) <> 1
        AND p.kind <> 'balance'`,
  },
  {
    name: "unpaid_payment_credit",
    description: "a payment that was never paid moved no money",
    query: sql`
      SELECT DISTINCT p.payment_id AS id FROM payments p
      JOIN ledger_entries l ON l.payment_id = p.payment_id
      WHERE p.status IN ('pending', 'failed', 'expired')`,
  },
  {
    name: "closed_cycle_charge",
    // Cycles closed with no charge at all are history imported from before
    // the app (their balances came in as opening amounts): not checked.
    description: "every member with a positive order on a closed cycle was charged for it",
    query: sql`
      SELECT o.cycle_id || ':' || o.member_id AS id FROM orders o
      JOIN order_cycles c ON c.cycle_id = o.cycle_id
      WHERE c.status IN ('closed', 'cancelled')
      GROUP BY o.cycle_id, o.member_id
      HAVING sum(o.line_total) > 0
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries l
          WHERE l.cycle_id = o.cycle_id AND l.member_id = o.member_id AND l.type = 'order_charge'
            AND l.reversed_by IS NULL
        )
        AND EXISTS (SELECT 1 FROM ledger_entries l WHERE l.cycle_id = o.cycle_id AND l.type = 'order_charge')`,
  },
  {
    name: "reversal_pairs",
    description: "every reversal cancels exactly its movement, which points back at it",
    query: sql`
      SELECT r.entry_id AS id FROM ledger_entries r
      LEFT JOIN ledger_entries o ON o.entry_id = r.reverses
      WHERE r.type = 'reversal'
        AND (o.entry_id IS NULL OR o.reversed_by IS DISTINCT FROM r.entry_id OR r.amount <> -o.amount
             OR r.member_id <> o.member_id)`,
  },
  {
    name: "reversed_without_reversal",
    description: "a movement marked reversed has its reversal row",
    query: sql`
      SELECT o.entry_id AS id FROM ledger_entries o
      WHERE o.reversed_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.entry_id = o.reversed_by AND r.reverses = o.entry_id)`,
  },
  {
    name: "paid_balance_credit",
    description: "every paid balance payment is credited for its whole amount, split over its parts",
    query: sql`
      SELECT p.payment_id AS id FROM payments p
      WHERE p.kind = 'balance' AND p.status IN ('succeeded', 'partially_refunded', 'refunded')
        AND coalesce((SELECT round(sum(l.amount) * 100) FROM ledger_entries l
                      WHERE l.payment_id = p.payment_id AND l.type = 'balance_payment'), 0) <> p.amount_cents`,
  },
  {
    name: "settled_cycle_credit",
    // A negative net is an amount due the member has not paid yet. Money left
    // that the card payments can still take back means a correction came
    // after the settlement: run Chiudi i conti again. What goes beyond the
    // card payments is given back in Cassa, outside the cycle, so it is not
    // counted here.
    description: "after a settlement no member keeps money on a pay-per-order cycle that could go back to the card",
    query: sql`
      SELECT c.cycle_id || ':' || l.member_id AS id FROM order_cycles c
      JOIN ledger_entries l ON l.cycle_id = c.cycle_id
      JOIN members m ON m.member_id = l.member_id
      WHERE c.payment_mode = 'per_order' AND c.settled_at IS NOT NULL AND NOT m.pays_offline
      GROUP BY c.cycle_id, l.member_id
      HAVING round(sum(l.amount) * 100) - coalesce((
          SELECT sum(r.amount_cents) FROM refunds r
          WHERE r.cycle_id = c.cycle_id AND r.member_id = l.member_id AND r.status = 'requested'), 0) > 0
        AND coalesce((
          SELECT sum(p.amount_cents - p.refunded_cents - coalesce((
            SELECT sum(r.amount_cents) FROM refunds r WHERE r.payment_id = p.payment_id AND r.status = 'requested'), 0))
          FROM payments p
          WHERE p.cycle_id = c.cycle_id AND p.member_id = l.member_id AND p.kind = 'order'
            AND p.status IN ('succeeded', 'partially_refunded')), 0) > 0`,
  },
];

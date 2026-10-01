import { sql, type SQL } from "drizzle-orm";
import type { PaymentMode } from "./settings";
import type { Db } from "./effects";
import { owedBackToCardSql } from "./settlement-sql";

// Changing the payment mode in Impostazioni (spec, "Cambio modalità"): only
// with no cycle running and every per_order cycle settled, and pay-per-order
// only in euros (the fee and Stripe's minimums are set for the euro) with a
// usable Stripe key. Balances stay as they are: a negative one becomes an
// amount due in pay-per-order, and goes back to a negative balance in wallet.

export type ModeChangeBlocker = "running_cycles" | "unsettled_cycles" | "currency" | "stripe_unavailable";

export function modeChangeBlockers(input: {
  target: PaymentMode;
  currency: string;
  stripeUsable: boolean;
  runningCycles: number;
  unsettledCycles: number;
}): ModeChangeBlocker[] {
  const blockers: ModeChangeBlocker[] = [];
  if (input.runningCycles > 0) blockers.push("running_cycles");
  if (input.unsettledCycles > 0) blockers.push("unsettled_cycles");
  if (input.target === "per_order") {
    if (input.currency.toUpperCase() !== "EUR") blockers.push("currency");
    if (!input.stripeUsable) blockers.push("stripe_unavailable");
  }
  return blockers;
}

// Cycles still taking or preparing orders.
export const runningCyclesSql: SQL = sql`
  (SELECT count(*)::integer FROM order_cycles WHERE status NOT IN ('closed', 'cancelled'))`;

// Closed per_order cycles with money or charges on them and not settled:
// never settled, settlement refunds still on their way, or a member the card
// still owes money to.
export const unsettledCyclesSql: SQL = sql`
  (SELECT count(*)::integer FROM order_cycles c
   WHERE c.payment_mode = 'per_order' AND c.status IN ('closed', 'cancelled')
     AND (EXISTS (SELECT 1 FROM ledger_entries l WHERE l.cycle_id = c.cycle_id)
          OR EXISTS (SELECT 1 FROM payments p WHERE p.cycle_id = c.cycle_id))
     AND (c.settled_at IS NULL
          OR EXISTS (SELECT 1 FROM refunds r WHERE r.cycle_id = c.cycle_id AND r.reason = 'settlement'
                       AND r.status IN ('requested', 'pending'))
          OR EXISTS (SELECT 1 FROM (SELECT DISTINCT l.member_id FROM ledger_entries l WHERE l.cycle_id = c.cycle_id) mm
                     WHERE ${owedBackToCardSql(sql.raw("mm.member_id"), sql.raw("c.cycle_id"))})))`;

export type ModeChangeState = {
  runningCycles: number;
  unsettledCycles: number;
  // Members' balances as they are now, shown before confirming.
  negative: { count: number; cents: number };
  positive: { count: number; cents: number };
};

export async function readModeChangeState(db: Db): Promise<ModeChangeState> {
  const { rows } = await db.execute<{
    running: number;
    unsettled: number;
    neg_count: number;
    neg_cents: number;
    pos_count: number;
    pos_cents: number;
  }>(sql`
    SELECT ${runningCyclesSql} AS running, ${unsettledCyclesSql} AS unsettled,
      count(*) FILTER (WHERE b.cents < 0)::integer AS neg_count,
      coalesce(sum(b.cents) FILTER (WHERE b.cents < 0), 0)::integer AS neg_cents,
      count(*) FILTER (WHERE b.cents > 0)::integer AS pos_count,
      coalesce(sum(b.cents) FILTER (WHERE b.cents > 0), 0)::integer AS pos_cents
    FROM (SELECT round(sum(amount) * 100) AS cents FROM ledger_entries GROUP BY member_id) b`);
  const r = rows[0];
  return {
    runningCycles: r?.running ?? 0,
    unsettledCycles: r?.unsettled ?? 0,
    negative: { count: r?.neg_count ?? 0, cents: r?.neg_cents ?? 0 },
    positive: { count: r?.pos_count ?? 0, cents: r?.pos_cents ?? 0 },
  };
}

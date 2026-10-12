import { sql } from "drizzle-orm";
import type { Db } from "./effects";
import { unsettledCyclesSql } from "./mode-change";
import type { StripeMoneyInFlight } from "./stripe-connect";

// What Stripe may still have to tell the app through the connected account's
// webhook (lib/payments/stripe-connect.ts, disconnectBlockers).
//   - Checkouts still pending, opened in the last 3 days: Stripe retries a
//     webhook for up to 3 days, so an older pending row can no longer be
//     resolved by an event and must not block the admin forever.
//   - Refunds asked of Stripe or on their way.
//   - Pay-per-order cycles running, or closed and not settled (the same
//     reading as the payment mode change).
export async function readStripeMoneyInFlight(db: Db): Promise<StripeMoneyInFlight> {
  const { rows } = await db.execute<{ pending: number; refunds: number; running: number; unsettled: number }>(sql`
    SELECT
      (SELECT count(*)::integer FROM payments
        WHERE status = 'pending' AND created_at > now() - interval '3 days') AS pending,
      (SELECT count(*)::integer FROM refunds WHERE status IN ('requested', 'pending')) AS refunds,
      (SELECT count(*)::integer FROM order_cycles
        WHERE payment_mode = 'per_order' AND status NOT IN ('closed', 'cancelled')) AS running,
      ${unsettledCyclesSql} AS unsettled`);
  const r = rows[0];
  return {
    pendingPayments: r?.pending ?? 0,
    openRefunds: r?.refunds ?? 0,
    unsettledCycles: (r?.running ?? 0) + (r?.unsettled ?? 0),
  };
}

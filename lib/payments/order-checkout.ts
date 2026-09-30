import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import type { Db } from "./effects";

// The Stripe calls around an order payment's Checkout, so tests pass a fake.
export type CheckoutApi = { checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "expire" | "retrieve"> } };

// Expires the member's open Checkouts on the cycle before a new one is
// created: without it, a double tap or a second tab ends in two payments for
// the same order. "paid" = one of them was completed and its webhook has not
// been handled yet: the caller must not start another payment now.
export async function expireOpenCheckouts(
  db: Db,
  stripe: CheckoutApi,
  memberId: string,
  cycleId: string,
): Promise<"clear" | "paid"> {
  const { rows } = await db.execute<{ payment_id: string; checkout_session_id: string | null }>(sql`
    SELECT payment_id, checkout_session_id FROM payments
    WHERE member_id = ${memberId} AND cycle_id = ${cycleId} AND kind = 'order' AND status = 'pending'
  `);
  for (const row of rows) {
    const close = (status: "expired" | "failed") =>
      db.execute(sql`
        UPDATE payments SET status = ${status}, updated_at = now()
        WHERE payment_id = ${row.payment_id} AND status = 'pending'
      `);
    if (!row.checkout_session_id) {
      await close("failed"); // its Checkout was never created
      continue;
    }
    try {
      await stripe.checkout.sessions.expire(row.checkout_session_id);
      await close("expired");
    } catch (e) {
      // Stripe refuses to expire a session that is no longer open: see why.
      const session = await stripe.checkout.sessions.retrieve(row.checkout_session_id);
      if (session.status === "complete") return "paid";
      if (session.status === "expired") await close("expired");
      else throw e;
    }
  }
  return "clear";
}

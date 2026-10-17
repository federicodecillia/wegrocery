import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { expireOpenCheckouts, type CheckoutApi } from "./order-checkout";

// Before a new Checkout for the same member and cycle, the open ones are
// expired on Stripe, so a double tap cannot end in two payments.
describeDb("expiring open order checkouts", () => {
  const scope = makeScope("ordchk");
  const { sql } = scope;
  let cycleId: string;

  function stripe(sessionStatus: Record<string, "open" | "complete" | "expired">) {
    const expire = vi.fn(async (id: string) => {
      if (sessionStatus[id] !== "open") throw Object.assign(new Error("not open"), { type: "StripeInvalidRequestError" });
      sessionStatus[id] = "expired";
      return { id, status: "expired" };
    });
    const retrieve = vi.fn(async (id: string) => ({ id, status: sessionStatus[id] }));
    return { api: { checkout: { sessions: { expire, retrieve } } } as unknown as CheckoutApi, expire };
  }
  const status = async (paymentId: string) =>
    (await sql`SELECT status FROM payments WHERE payment_id = ${paymentId}`)[0].status;

  beforeAll(async () => {
    await scope.createMember();
    ({ cycleId } = await scope.createCycle("c", { paymentMode: "per_order" }));
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("expires every open checkout of the member on the cycle and closes its row", async () => {
    const a = await scope.createPendingOrderPayment("a", cycleId, 500, []);
    const b = await scope.createPendingOrderPayment("b", cycleId, 700, []);
    const s = stripe({ [a.sessionId]: "open", [b.sessionId]: "expired" }); // b expired on Stripe, webhook not in yet
    expect(await expireOpenCheckouts(getDb(), s.api, scope.memberId, cycleId)).toBe("clear");
    expect(await status(a.paymentId)).toBe("expired");
    expect(await status(b.paymentId)).toBe("expired");
    // Nothing pending is left to expire.
    expect(await expireOpenCheckouts(getDb(), s.api, scope.memberId, cycleId)).toBe("clear");
    expect(s.expire).toHaveBeenCalledTimes(2);
  });

  it("stops when a checkout was paid and its webhook has not arrived yet", async () => {
    const c = await scope.createPendingOrderPayment("c", cycleId, 900, []);
    const s = stripe({ [c.sessionId]: "complete" });
    expect(await expireOpenCheckouts(getDb(), s.api, scope.memberId, cycleId)).toBe("paid");
    expect(await status(c.paymentId)).toBe("pending"); // the webhook will credit it
    await sql`UPDATE payments SET status = 'expired' WHERE payment_id = ${c.paymentId}`;
  });

  it("leaves alone a row whose checkout may still be being created, and closes an old one", async () => {
    const d = await scope.createPendingOrderPayment("d", cycleId, 900, []);
    await sql`UPDATE payments SET checkout_session_id = NULL WHERE payment_id = ${d.paymentId}`;
    expect(await expireOpenCheckouts(getDb(), stripe({}).api, scope.memberId, cycleId)).toBe("paid");
    expect(await status(d.paymentId)).toBe("pending");
    await sql`UPDATE payments SET created_at = now() - interval '10 minutes' WHERE payment_id = ${d.paymentId}`;
    expect(await expireOpenCheckouts(getDb(), stripe({}).api, scope.memberId, cycleId)).toBe("clear");
    expect(await status(d.paymentId)).toBe("failed");
  });

  it("expires the member's open balance checkouts and leaves the order ones alone", async () => {
    const order = await scope.createPendingOrderPayment("o", cycleId, 500, []);
    const balanceId = scope.id("bal");
    await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency, refunded_cents,
        checkout_session_id, created_at, updated_at, kind)
      VALUES (${balanceId}, ${scope.memberId}, 'stripe', 'pending', 400, 'eur', 0, ${`cs_${balanceId}`}, now(), now(),
        'balance')`;
    const s = stripe({ [order.sessionId]: "open", [`cs_${balanceId}`]: "open" });
    expect(await expireOpenCheckouts(getDb(), s.api, scope.memberId, null, "balance")).toBe("clear");
    expect(await status(balanceId)).toBe("expired");
    expect(await status(order.paymentId)).toBe("pending");
    await sql`UPDATE payments SET status = 'expired' WHERE payment_id = ${order.paymentId}`;
  });
});

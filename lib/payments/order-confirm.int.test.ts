import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { cancelOrderWrite, confirmOrderWithoutPayment, getCycleCoverageCents } from "./order-confirm";

// The member-side writes of pay-per-order on a real database: what a cycle's
// payments cover, a confirmation that needs no payment, and cancelling.
describeDb("order confirmation and cancellation", () => {
  const scope = makeScope("ordconf");
  const { sql } = scope;
  const products = [
    { name: "Bread", unitPrice: 4 },
    { name: "Oil", unitPrice: 9.5 },
  ];

  async function orders(cycleId: string) {
    const rows = await sql`SELECT product_id, quantity, line_total::text AS total FROM orders
      WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId} ORDER BY product_id`;
    return rows.map((o) => `${o.product_id} x${o.quantity} = ${o.total}`);
  }
  async function refunds(cycleId: string) {
    const rows = await sql`SELECT refund_id, status, reason, amount_cents FROM refunds
      WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId} ORDER BY refund_id`;
    return rows.map((r) => `${r.refund_id} ${r.status} ${r.reason} ${r.amount_cents}`);
  }

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("counts what was paid for the cycle, minus what came back or is on its way back", async () => {
    const { cycleId } = await scope.createCycle("cov", { paymentMode: "per_order", products });
    const other = await scope.createCycle("cov_other", { paymentMode: "per_order", products });
    expect(await getCycleCoverageCents(getDb(), scope.memberId, cycleId)).toBe(0);

    const a = await scope.createPaidOrderPayment("cov_a", cycleId, 2500);
    await scope.createPaidOrderPayment("cov_b", cycleId, 1100);
    await scope.createPaidOrderPayment("cov_x", other.cycleId, 900); // another cycle: not counted
    expect(await getCycleCoverageCents(getDb(), scope.memberId, cycleId)).toBe(3600);

    await scope.createRequestedRefund(`cancel_${a.paymentId}`, a.paymentId, cycleId, 2500, "order_cancelled");
    expect(await getCycleCoverageCents(getDb(), scope.memberId, cycleId)).toBe(1100);
  });

  it("confirms a covered order without a payment, replacing the lines and dropping the draft", async () => {
    const { cycleId, productIds } = await scope.createCycle("conf", { paymentMode: "per_order", products });
    await scope.createPaidOrderPayment("conf", cycleId, 2500);
    await sql`INSERT INTO order_drafts (member_id, cycle_id, lines, updated_at)
      VALUES (${scope.memberId}, ${cycleId}, '[]'::jsonb, now())`;

    const ok = await confirmOrderWithoutPayment(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 3, unitPrice: "4.00" }],
      expectedCoveredCents: 2500,
    });
    expect(ok).toBe("confirmed");
    expect(await orders(cycleId)).toEqual([`${productIds[0]} x3 = 12.00`]);
    const drafts = await sql`SELECT 1 FROM order_drafts WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId}`;
    expect(drafts).toEqual([]);
  });

  it("refuses the confirmation when the coverage changed since it was read", async () => {
    const { cycleId, productIds } = await scope.createCycle("stale", { paymentMode: "per_order", products });
    const pay = await scope.createPaidOrderPayment("stale", cycleId, 2500);
    // A refund was asked for after the page computed "nothing to pay".
    await scope.createRequestedRefund(`cancel_${pay.paymentId}`, pay.paymentId, cycleId, 2500, "order_cancelled");

    const result = await confirmOrderWithoutPayment(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 1, unitPrice: "4.00" }],
      expectedCoveredCents: 2500,
    });
    expect(result).toBe("changed");
    expect(await orders(cycleId)).toEqual([]);
  });

  it("refuses the confirmation on a closed cycle", async () => {
    const { cycleId, productIds } = await scope.createCycle("closed", { paymentMode: "per_order", products });
    await sql`UPDATE order_cycles SET status = 'closed' WHERE cycle_id = ${cycleId}`;
    const result = await confirmOrderWithoutPayment(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 1, unitPrice: "4.00" }],
      expectedCoveredCents: 0,
    });
    expect(result).toBe("changed");
  });

  it("cancels the order and asks once for the refund of what is left of each payment", async () => {
    const { cycleId, productIds } = await scope.createCycle("canc", { paymentMode: "per_order", products });
    const a = await scope.createPaidOrderPayment("canc_a", cycleId, 2500);
    const b = await scope.createPaidOrderPayment("canc_b", cycleId, 1100);
    // b was already refunded 400 from the Stripe Dashboard.
    await sql`UPDATE payments SET refunded_cents = 400, status = 'partially_refunded' WHERE payment_id = ${b.paymentId}`;
    // A checkout still open must not be refunded: nothing was paid.
    await scope.createPendingOrderPayment("canc_open", cycleId, 500, []);
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id("canc_line")}, ${cycleId}, ${scope.memberId}, ${productIds[0]}, 2, 4, 8, now())`;

    const first = await cancelOrderWrite(getDb(), scope.memberId, cycleId);
    expect(first).toEqual({ status: "cancelled", refundIds: [`cancel_${a.paymentId}`, `cancel_${b.paymentId}`] });
    expect(await orders(cycleId)).toEqual([]);
    expect(await refunds(cycleId)).toEqual([
      `cancel_${a.paymentId} requested order_cancelled 2500`,
      `cancel_${b.paymentId} requested order_cancelled 700`,
    ]);
    expect(await getCycleCoverageCents(getDb(), scope.memberId, cycleId)).toBe(400); // only the Dashboard refund is unaccounted

    // Again: nothing new to refund.
    expect(await cancelOrderWrite(getDb(), scope.memberId, cycleId)).toEqual({ status: "cancelled", refundIds: [] });
    expect((await refunds(cycleId)).length).toBe(2);
  });

  it("does not cancel on a closed cycle: the order was charged", async () => {
    const { cycleId, productIds } = await scope.createCycle("canc_closed", { paymentMode: "per_order", products });
    await scope.createPaidOrderPayment("canc_closed", cycleId, 800);
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id("cc_line")}, ${cycleId}, ${scope.memberId}, ${productIds[0]}, 2, 4, 8, now())`;
    await sql`UPDATE order_cycles SET status = 'closed' WHERE cycle_id = ${cycleId}`;

    expect(await cancelOrderWrite(getDb(), scope.memberId, cycleId)).toEqual({ status: "cycle_not_open" });
    expect(await orders(cycleId)).toEqual([`${productIds[0]} x2 = 8.00`]);
    expect(await refunds(cycleId)).toEqual([]);
  });
});

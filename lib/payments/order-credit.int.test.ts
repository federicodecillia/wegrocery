import type Stripe from "stripe";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { applyOrderCredit } from "./order-credit";
import type { RefundApi } from "./refund-request";
import { planWebhookAction } from "./webhook";

// checkout.session.completed for an order payment, on a real database: the
// order is written from the paid snapshot, a replay changes nothing, and a
// payment that can no longer become an order is refunded in full.
describeDb("order payment credit", () => {
  const scope = makeScope("ordcred");
  const { sql } = scope;

  function acceptingStripe(): RefundApi {
    return {
      refunds: {
        create: vi.fn(async (params: { payment_intent: string; amount: number; metadata: { refundId: string } }) => ({
          id: `re_${params.metadata.refundId}`,
          object: "refund",
          payment_intent: params.payment_intent,
          amount: params.amount,
          currency: "eur",
          status: "succeeded",
          created: Math.floor(Date.now() / 1000),
          metadata: params.metadata,
        })),
      },
    } as unknown as RefundApi;
  }

  function completed(
    pay: { paymentId: string; sessionId: string; paymentIntentId: string },
    cycleId: string,
    amount: number,
  ) {
    const event = {
      id: `evt_${pay.sessionId}`,
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: pay.sessionId,
          metadata: { paymentId: pay.paymentId, memberId: scope.memberId, cycleId, kind: "order" },
          payment_status: "paid",
          amount_total: amount,
          currency: "eur",
          payment_intent: pay.paymentIntentId,
        },
      },
    } as unknown as Stripe.Event;
    const action = planWebhookAction(event);
    if (action.kind !== "order_credit") throw new Error(`planned ${action.kind}`);
    return action;
  }

  async function state(paymentId: string, cycleId: string) {
    const [p] = await sql`SELECT status, refunded_cents FROM payments WHERE payment_id = ${paymentId}`;
    const orders = await sql`SELECT product_id, quantity, unit_price_snapshot::text AS price, line_total::text AS total
      FROM orders WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId} ORDER BY product_id`;
    const ledger = await sql`SELECT type, amount::text AS amount FROM ledger_entries
      WHERE payment_id = ${paymentId} ORDER BY created_at, entry_id`;
    const refunds = await sql`SELECT refund_id, status, reason, amount_cents FROM refunds WHERE payment_id = ${paymentId}`;
    return {
      payment: `${p.status} ${p.refunded_cents}`,
      orders: orders.map((o) => `${o.product_id} x${o.quantity} @${o.price} = ${o.total}`),
      ledger: ledger.map((l) => `${l.type} ${l.amount}`),
      refunds: refunds.map((r) => `${r.refund_id} ${r.status} ${r.reason} ${r.amount_cents}`),
    };
  }

  const products = [
    { name: "Bread", unitPrice: 4 },
    { name: "Oil", unitPrice: 9.5 },
    { name: "Honey", unitPrice: 7 },
  ];

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("writes the order from the paid snapshot, credits the payment once and replaces the previous order", async () => {
    const { cycleId, productIds } = await scope.createCycle("ok", { paymentMode: "per_order", products });
    // A previously confirmed order, and a current price that changed after
    // the checkout started: the snapshot wins on both.
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id("old_line")}, ${cycleId}, ${scope.memberId}, ${productIds[2]}, 1, 7, 7, now())`;
    await sql`UPDATE products SET unit_price = 5 WHERE product_id = ${productIds[0]}`;
    await sql`INSERT INTO order_drafts (member_id, cycle_id, lines, updated_at)
      VALUES (${scope.memberId}, ${cycleId}, ${JSON.stringify([
        { productId: productIds[0], quantity: 2 },
        { productId: productIds[1], quantity: 1 },
      ])}::jsonb, now())`;
    const pay = await scope.createPendingOrderPayment("ok", cycleId, 1925, [
      { productId: productIds[0], quantity: 2, unitPriceCents: 400 },
      { productId: productIds[1], quantity: 1, unitPriceCents: 950 },
    ]);

    await applyOrderCredit(completed(pay, cycleId, 1925), null);
    const expected = {
      payment: "succeeded 0",
      orders: [`${productIds[0]} x2 @4.00 = 8.00`, `${productIds[1]} x1 @9.50 = 9.50`],
      ledger: ["order_payment 19.25"],
      refunds: [],
    };
    expect(await state(pay.paymentId, cycleId)).toEqual(expected);
    const [led] = await sql`SELECT cycle_id FROM ledger_entries WHERE payment_id = ${pay.paymentId}`;
    expect(led.cycle_id).toBe(cycleId);
    const drafts = await sql`SELECT 1 FROM order_drafts WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId}`;
    expect(drafts).toEqual([]); // the draft was what got paid
    const notes = await sql`SELECT type FROM notifications WHERE member_id = ${scope.memberId} AND type = 'order_paid'`;
    expect(notes.length).toBe(1);

    // The same event again: nothing moves.
    await applyOrderCredit(completed(pay, cycleId, 1925), null);
    expect(await state(pay.paymentId, cycleId)).toEqual(expected);
  });

  it("refunds in full a payment completed after the cycle closed, and writes no order", async () => {
    const { cycleId, productIds } = await scope.createCycle("late", { paymentMode: "per_order", products });
    const pay = await scope.createPendingOrderPayment("late", cycleId, 880, [
      { productId: productIds[0], quantity: 2, unitPriceCents: 400 },
    ]);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;

    await applyOrderCredit(completed(pay, cycleId, 880), acceptingStripe());
    expect(await state(pay.paymentId, cycleId)).toEqual({
      payment: "refunded 880",
      orders: [],
      ledger: ["order_payment 8.80", "order_refund -8.80"],
      refunds: [`late_${pay.paymentId} succeeded late_payment 880`],
    });
  });

  it("keeps the refund requested when Stripe cannot be reached on the late path", async () => {
    const { cycleId, productIds } = await scope.createCycle("late2", { paymentMode: "per_order", products });
    const pay = await scope.createPendingOrderPayment("late2", cycleId, 440, [
      { productId: productIds[0], quantity: 1, unitPriceCents: 400 },
    ]);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;

    await applyOrderCredit(completed(pay, cycleId, 440), null);
    expect(await state(pay.paymentId, cycleId)).toEqual({
      payment: "succeeded 0",
      orders: [],
      ledger: ["order_payment 4.40"],
      refunds: [`late_${pay.paymentId} requested late_payment 440`],
    });
    // The event again does not ask for a second refund.
    await applyOrderCredit(completed(pay, cycleId, 440), null);
    expect((await state(pay.paymentId, cycleId)).refunds.length).toBe(1);
  });

  it("treats a product removed from the cycle during the checkout like a late payment", async () => {
    const { cycleId, productIds } = await scope.createCycle("gone", { paymentMode: "per_order", products });
    const pay = await scope.createPendingOrderPayment("gone", cycleId, 770, [
      { productId: productIds[2], quantity: 1, unitPriceCents: 700 },
    ]);
    await sql`UPDATE products SET active = false WHERE product_id = ${productIds[2]}`;

    await applyOrderCredit(completed(pay, cycleId, 770), acceptingStripe());
    const s = await state(pay.paymentId, cycleId);
    expect(s.orders).toEqual([]);
    expect(s.refunds).toEqual([`late_${pay.paymentId} succeeded late_payment 770`]);
  });

  it("writes nothing when the paid amount is not the one the app asked for", async () => {
    const { cycleId, productIds } = await scope.createCycle("mis", { paymentMode: "per_order", products });
    const pay = await scope.createPendingOrderPayment("mis", cycleId, 440, [
      { productId: productIds[0], quantity: 1, unitPriceCents: 400 },
    ]);

    await applyOrderCredit(completed(pay, cycleId, 100), acceptingStripe());
    expect(await state(pay.paymentId, cycleId)).toEqual({ payment: "pending 0", orders: [], ledger: [], refunds: [] });
    const audits = await sql`SELECT action FROM audit_log WHERE entity_id = ${pay.paymentId}`;
    expect(audits.map((a) => a.action)).toEqual(["stripe_order_mismatch"]);
  });

  it("ends with either an order or a full refund when the cycle closes while the payment lands", async () => {
    for (let round = 0; round < 4; round++) {
      const { cycleId, productIds } = await scope.createCycle(`race${round}`, { paymentMode: "per_order", products });
      const pay = await scope.createPendingOrderPayment(`race${round}`, cycleId, 440, [
        { productId: productIds[0], quantity: 1, unitPriceCents: 400 },
      ]);
      // The close takes the same row lock as the credit (performCycleClose).
      const close = sql`UPDATE order_cycles SET status = 'closed', closed_at = now()
        WHERE cycle_id = ${cycleId} AND status = 'open'`;
      await Promise.all(
        round % 2 === 0
          ? [applyOrderCredit(completed(pay, cycleId, 440), acceptingStripe()), close]
          : [close, applyOrderCredit(completed(pay, cycleId, 440), acceptingStripe())],
      );
      const s = await state(pay.paymentId, cycleId);
      expect(s.ledger[0]).toBe("order_payment 4.40");
      const hasOrder = s.orders.length === 1;
      const refunded = s.refunds.length === 1 && s.payment === "refunded 440";
      expect(hasOrder !== refunded, JSON.stringify(s)).toBe(true);
    }
  });

  it("refunds a payment whose row was closed while its Checkout was still being created", async () => {
    const { cycleId, productIds } = await scope.createCycle("closedrow", { paymentMode: "per_order", products });
    const pay = await scope.createPendingOrderPayment("closedrow", cycleId, 440, [
      { productId: productIds[0], quantity: 1, unitPriceCents: 400 },
    ]);
    // Another tab expired the member's checkouts and closed this row as failed.
    await sql`UPDATE payments SET status = 'failed', checkout_session_id = NULL WHERE payment_id = ${pay.paymentId}`;

    await applyOrderCredit(completed(pay, cycleId, 440), acceptingStripe());
    const s = await state(pay.paymentId, cycleId);
    expect(s.ledger).toEqual(["order_payment 4.40", "order_refund -4.40"]);
    expect(s.refunds).toEqual([`late_${pay.paymentId} succeeded late_payment 440`]);
    expect(s.orders).toEqual([]);
  });
});

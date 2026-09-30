import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { sendRequestedRefund, type RefundApi } from "./refund-request";

// Refunds the app asks Stripe for (cancelled order, late payment), with a
// fake Stripe: accepted, asked twice, rejected, and unreachable then retried.
describeDb("refunds requested by the app", () => {
  const scope = makeScope("refreq");
  const { sql } = scope;
  let cycleId: string;

  function acceptingStripe() {
    const create = vi.fn(async (params: { payment_intent: string; amount: number; metadata: { refundId: string } }) => ({
      id: `re_${params.metadata.refundId}`,
      object: "refund",
      payment_intent: params.payment_intent,
      amount: params.amount,
      currency: "eur",
      status: "succeeded",
      created: Math.floor(Date.now() / 1000),
      metadata: params.metadata,
    }));
    return { api: { refunds: { create } } as unknown as RefundApi, create };
  }
  function failingStripe(error: unknown): RefundApi {
    return { refunds: { create: vi.fn(async () => Promise.reject(error)) } } as unknown as RefundApi;
  }

  async function state(paymentId: string) {
    const [p] = await sql`SELECT status, refunded_cents FROM payments WHERE payment_id = ${paymentId}`;
    const refunds = await sql`SELECT refund_id, status, stripe_refund_id FROM refunds WHERE payment_id = ${paymentId}`;
    const ledger = await sql`SELECT type, amount::text AS amount, cycle_id FROM ledger_entries
      WHERE payment_id = ${paymentId} AND type <> 'order_payment' ORDER BY created_at, entry_id`;
    return {
      payment: `${p.status} ${p.refunded_cents}`,
      refunds: refunds.map((r) => `${r.refund_id} ${r.status} ${r.stripe_refund_id ?? "-"}`),
      ledger: ledger.map((l) => `${l.type} ${l.amount} ${l.cycle_id}`),
    };
  }

  beforeAll(async () => {
    await scope.createMember();
    ({ cycleId } = await scope.createCycle("c", { paymentMode: "per_order" }));
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("asks Stripe once, with the refund id as idempotency key, and records the refund on the cycle", async () => {
    const pay = await scope.createPaidOrderPayment("ok", cycleId, 2500);
    const refundId = `cancel_${pay.paymentId}`;
    await scope.createRequestedRefund(refundId, pay.paymentId, cycleId, 2500, "order_cancelled");
    const stripe = acceptingStripe();

    expect(await sendRequestedRefund(refundId, stripe.api)).toBe("sent");
    expect(stripe.create).toHaveBeenCalledWith(
      { payment_intent: pay.paymentIntentId, amount: 2500, metadata: { refundId } },
      { idempotencyKey: refundId },
    );
    expect(await state(pay.paymentId)).toEqual({
      payment: "refunded 2500",
      refunds: [`${refundId} succeeded re_${refundId}`],
      ledger: [`order_refund -25.00 ${cycleId}`],
    });
    const notes = await sql`SELECT type FROM notifications WHERE member_id = ${scope.memberId}`;
    expect(notes.map((n) => n.type)).toEqual(["order_refund_sent"]);

    // A second call finds nothing left to ask.
    expect(await sendRequestedRefund(refundId, stripe.api)).toBe("skipped");
    expect(stripe.create).toHaveBeenCalledTimes(1);
  });

  it("marks the refund failed, with no movement, when Stripe rejects the request", async () => {
    const pay = await scope.createPaidOrderPayment("rej", cycleId, 1000);
    const refundId = `cancel_${pay.paymentId}`;
    await scope.createRequestedRefund(refundId, pay.paymentId, cycleId, 1000, "order_cancelled");

    expect(await sendRequestedRefund(refundId, failingStripe({ type: "StripeInvalidRequestError" }))).toBe("failed");
    expect(await state(pay.paymentId)).toEqual({
      payment: "succeeded 0",
      refunds: [`${refundId} failed -`],
      ledger: [],
    });
  });

  it("leaves the refund requested when Stripe cannot be reached, and a retry sends it", async () => {
    const pay = await scope.createPaidOrderPayment("net", cycleId, 1200);
    const refundId = `late_${pay.paymentId}`;
    await scope.createRequestedRefund(refundId, pay.paymentId, cycleId, 1200, "late_payment");

    expect(await sendRequestedRefund(refundId, failingStripe({ type: "StripeConnectionError" }))).toBe("retry");
    expect((await state(pay.paymentId)).refunds).toEqual([`${refundId} requested -`]);
    expect(await sendRequestedRefund(refundId, null)).toBe("retry"); // no Stripe on this deploy right now

    expect(await sendRequestedRefund(refundId, acceptingStripe().api)).toBe("sent");
    expect(await state(pay.paymentId)).toEqual({
      payment: "refunded 1200",
      refunds: [`${refundId} succeeded re_${refundId}`],
      ledger: [`order_refund -12.00 ${cycleId}`],
    });
  });
});

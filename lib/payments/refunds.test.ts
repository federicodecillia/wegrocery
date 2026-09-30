import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  planRefundTransition,
  refundedCentsDelta,
  refundInputOf,
  refundLedgerRow,
  refundStatusOf,
  type RefundStatus,
} from "./refunds";

function stripeRefund(fields: Record<string, unknown>): Stripe.Refund {
  return {
    id: "re_1",
    object: "refund",
    payment_intent: "pi_1",
    amount: 400,
    currency: "eur",
    status: "succeeded",
    created: 1790000000,
    metadata: {},
    ...fields,
  } as unknown as Stripe.Refund;
}

describe("refundInputOf", () => {
  it("keeps what the app needs from a Stripe refund", () => {
    expect(refundInputOf(stripeRefund({}))).toEqual({
      stripeRefundId: "re_1",
      paymentIntentId: "pi_1",
      amountCents: 400,
      currency: "eur",
      status: "succeeded",
      appRefundId: null,
      createdAt: 1790000000,
    });
  });

  it("reads an expanded payment intent and the app's refund id", () => {
    const input = refundInputOf(stripeRefund({ payment_intent: { id: "pi_2" }, metadata: { refundId: "cancel_pay_1" } }));
    expect(input).toMatchObject({ paymentIntentId: "pi_2", appRefundId: "cancel_pay_1" });
  });

  it("skips refunds with no payment intent or no status", () => {
    expect(refundInputOf(stripeRefund({ payment_intent: null }))).toBeNull();
    expect(refundInputOf(stripeRefund({ status: null }))).toBeNull();
  });
});

describe("refundStatusOf", () => {
  it("treats requires_action as accepted and not paid yet", () => {
    expect(refundStatusOf("requires_action")).toBe("pending");
    expect(refundStatusOf("pending")).toBe("pending");
  });

  it("keeps the final states and drops unknown ones", () => {
    expect(refundStatusOf("succeeded")).toBe("succeeded");
    expect(refundStatusOf("failed")).toBe("failed");
    expect(refundStatusOf("canceled")).toBe("canceled");
    expect(refundStatusOf("something_new")).toBeNull();
  });
});

describe("planRefundTransition", () => {
  const plan = (current: RefundStatus, stripe: string) => planRefundTransition(current, stripe);

  it("debits the balance the first time Stripe accepts a refund", () => {
    expect(plan("requested", "succeeded")).toEqual({ status: "succeeded", movement: "debit" });
    expect(plan("requested", "pending")).toEqual({ status: "pending", movement: "debit" });
    expect(plan("requested", "requires_action")).toEqual({ status: "pending", movement: "debit" });
  });

  it("moves a pending refund to succeeded without debiting again", () => {
    expect(plan("pending", "succeeded")).toEqual({ status: "succeeded", movement: null });
  });

  it("ignores replays and a pending event that arrives after succeeded", () => {
    expect(plan("pending", "pending")).toBeNull();
    expect(plan("succeeded", "succeeded")).toBeNull();
    expect(plan("succeeded", "pending")).toBeNull();
    expect(plan("succeeded", "requires_action")).toBeNull();
  });

  it("reverses an accepted refund that fails or is canceled", () => {
    expect(plan("succeeded", "failed")).toEqual({ status: "failed", movement: "reversal" });
    expect(plan("pending", "failed")).toEqual({ status: "failed", movement: "reversal" });
    expect(plan("succeeded", "canceled")).toEqual({ status: "canceled", movement: "reversal" });
  });

  it("closes a refund that fails before it was ever accepted, with no movement", () => {
    expect(plan("requested", "failed")).toEqual({ status: "failed", movement: null });
    expect(plan("requested", "canceled")).toEqual({ status: "canceled", movement: null });
  });

  it("never reopens a failed or canceled refund", () => {
    expect(plan("failed", "succeeded")).toBeNull();
    expect(plan("failed", "failed")).toBeNull();
    expect(plan("canceled", "failed")).toBeNull();
    expect(plan("canceled", "pending")).toBeNull();
  });

  it("does nothing on a status it does not know", () => {
    expect(plan("requested", "something_new")).toBeNull();
    expect(plan("succeeded", "something_new")).toBeNull();
  });
});

describe("refundLedgerRow", () => {
  it("debits a top-up refund as a correction", () => {
    expect(refundLedgerRow(null, 400, "debit")).toEqual({ type: "correction", amountCents: -400 });
  });

  it("debits the refund of a cycle's payment as an order refund", () => {
    expect(refundLedgerRow("cyc_1", 400, "debit")).toEqual({ type: "order_refund", amountCents: -400 });
  });

  it("credits the amount back when the refund fails", () => {
    expect(refundLedgerRow(null, 400, "reversal")).toEqual({ type: "refund_failed", amountCents: 400 });
    expect(refundLedgerRow("cyc_1", 400, "reversal")).toEqual({ type: "refund_failed", amountCents: 400 });
  });
});

describe("refundedCentsDelta", () => {
  it("adds a debited refund to the payment and takes a reversed one back", () => {
    expect(refundedCentsDelta("debit", 400)).toBe(400);
    expect(refundedCentsDelta("reversal", 400)).toBe(-400);
  });
});

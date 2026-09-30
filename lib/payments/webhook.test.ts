import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

// webhook.ts pulls in the DB client and notifications; the planner under test
// is pure, so stub the I/O modules out.
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/queries", () => ({ getMemberBalance: vi.fn() }));
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotification: vi.fn() }));
vi.mock("./refund-store", () => ({ upsertStripeRefund: vi.fn(), syncChargeRefunds: vi.fn() }));

const { planWebhookAction } = await import("./webhook");

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: "evt_1", type, livemode: false, data: { object } } as unknown as Stripe.Event;
}

const paidSession = {
  id: "cs_1",
  metadata: { paymentId: "pay_1", memberId: "mem_1" },
  payment_status: "paid",
  amount_total: 5000,
  currency: "eur",
  payment_intent: "pi_1",
};

describe("planWebhookAction", () => {
  it("credits a paid session with the amount Stripe charged", () => {
    expect(planWebhookAction(event("checkout.session.completed", paidSession))).toEqual({
      kind: "credit",
      paymentId: "pay_1",
      sessionId: "cs_1",
      amountCents: 5000,
      currency: "eur",
      paymentIntentId: "pi_1",
    });
    expect(planWebhookAction(event("checkout.session.async_payment_succeeded", paidSession))).toMatchObject({
      kind: "credit",
    });
  });

  it("waits for the async event when a completed session is still unpaid", () => {
    const unpaid = { ...paidSession, payment_status: "unpaid" };
    expect(planWebhookAction(event("checkout.session.completed", unpaid))).toEqual({ kind: "ignore" });
  });

  it("ignores sessions this app did not create", () => {
    expect(planWebhookAction(event("checkout.session.completed", { ...paidSession, metadata: {} }))).toEqual({
      kind: "ignore",
    });
  });

  it("closes failed and expired sessions", () => {
    expect(planWebhookAction(event("checkout.session.async_payment_failed", paidSession))).toEqual({
      kind: "close",
      paymentId: "pay_1",
      sessionId: "cs_1",
      status: "failed",
    });
    expect(planWebhookAction(event("checkout.session.expired", paidSession))).toMatchObject({
      kind: "close",
      status: "expired",
    });
  });

  it("re-reads the refunds of a refunded charge from Stripe", () => {
    expect(
      planWebhookAction(event("charge.refunded", { payment_intent: { id: "pi_1" }, amount_refunded: 1500 })),
    ).toEqual({ kind: "refund_sync", paymentIntentId: "pi_1" });
  });

  const refund = {
    id: "re_1",
    object: "refund",
    payment_intent: "pi_1",
    amount: 400,
    currency: "eur",
    status: "succeeded",
    created: 1790000000,
    metadata: {},
  };

  it("hands every refund event to the refund it carries", () => {
    for (const type of ["refund.created", "refund.updated", "refund.failed"]) {
      expect(planWebhookAction(event(type, refund))).toEqual({
        kind: "refund",
        refund: {
          stripeRefundId: "re_1",
          paymentIntentId: "pi_1",
          amountCents: 400,
          currency: "eur",
          status: "succeeded",
          appRefundId: null,
          createdAt: 1790000000,
        },
      });
    }
  });

  it("ignores refunds that are not of a payment intent", () => {
    expect(planWebhookAction(event("refund.created", { ...refund, payment_intent: null }))).toEqual({
      kind: "ignore",
    });
    expect(planWebhookAction(event("charge.refunded", { payment_intent: null, amount_refunded: 100 }))).toEqual({
      kind: "ignore",
    });
  });

  it("ignores everything else", () => {
    expect(planWebhookAction(event("customer.created", {}))).toEqual({ kind: "ignore" });
  });
});

import type Stripe from "stripe";

// Pure rules of the Stripe refunds (table refunds, drizzle/0020_stripe_refunds.sql).
// The database side is lib/payments/refund-store.ts.

export const REFUND_STATUSES = ["requested", "pending", "succeeded", "failed", "canceled"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

// Why a refund exists (refunds.reason). Only 'dashboard' is written until the
// app starts refunds itself (B2.2).
export type RefundReason = "settlement" | "order_cancelled" | "late_payment" | "dashboard";

// What the app needs from a Stripe refund, whether it comes from an API
// response or a webhook event.
export type StripeRefundInput = {
  stripeRefundId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  // Stripe's own status: pending | requires_action | succeeded | failed | canceled.
  status: string;
  // metadata.refundId, set on the refunds the app asks for; null on Dashboard ones.
  appRefundId: string | null;
  // When Stripe created it, in Unix seconds.
  createdAt: number;
};

export function refundInputOf(refund: Stripe.Refund): StripeRefundInput | null {
  const intent = refund.payment_intent;
  const paymentIntentId = typeof intent === "string" ? intent : (intent?.id ?? null);
  if (!paymentIntentId || !refund.status) return null;
  return {
    stripeRefundId: refund.id,
    paymentIntentId,
    amountCents: refund.amount,
    currency: refund.currency,
    status: refund.status,
    appRefundId: refund.metadata?.refundId ?? null,
    createdAt: refund.created,
  };
}

// Stripe's status as one of ours. requires_action is accepted but not paid
// yet, like pending. An unknown status is null and changes nothing.
export function refundStatusOf(stripeStatus: string): Exclude<RefundStatus, "requested"> | null {
  switch (stripeStatus) {
    case "pending":
    case "requires_action":
      return "pending";
    case "succeeded":
    case "failed":
    case "canceled":
      return stripeStatus;
    default:
      return null;
  }
}

// debit: the refund leaves the member's balance, the first time Stripe
// accepts it. reversal: Stripe could not pay an accepted refund, so the money
// comes back on the balance.
export type RefundMovement = "debit" | "reversal";
export type RefundTransition = { status: RefundStatus; movement: RefundMovement | null };

const CLOSED: ReadonlySet<RefundStatus> = new Set(["failed", "canceled"]);

// What a Stripe status does to a refund now in `current` ('requested' for a
// refund not recorded yet). null = nothing to write: a replay, an older event
// arriving late (pending after succeeded), anything after failed or canceled.
export function planRefundTransition(current: RefundStatus, stripeStatus: string): RefundTransition | null {
  const next = refundStatusOf(stripeStatus);
  if (next === null || CLOSED.has(current)) return null;
  if (next === "pending" || next === "succeeded") {
    if (current === "requested") return { status: next, movement: "debit" };
    if (current === "pending" && next === "succeeded") return { status: "succeeded", movement: null };
    return null;
  }
  return { status: next, movement: current === "requested" ? null : "reversal" };
}

// The ledger row of a movement, in signed cents. A top-up refund stays a
// 'correction' as before 1.15.0; the refund of a cycle's payment (B2.2) is an
// 'order_refund' of that cycle; a reversal is 'refund_failed'.
export function refundLedgerRow(
  cycleId: string | null,
  amountCents: number,
  movement: RefundMovement,
): { type: string; amountCents: number } {
  if (movement === "reversal") return { type: "refund_failed", amountCents };
  return { type: cycleId === null ? "correction" : "order_refund", amountCents: -amountCents };
}

// How a movement changes payments.refunded_cents.
export function refundedCentsDelta(movement: RefundMovement, amountCents: number): number {
  return movement === "debit" ? amountCents : -amountCents;
}

// Which ledger note a refund movement gets (the strings are in t.ledger and
// t.topup).
export type RefundNoteKind = "topup" | "order" | "orderCancelled" | "latePayment" | "failed";

export function refundNoteKind(cycleId: string | null, reason: string, movement: RefundMovement): RefundNoteKind {
  if (movement === "reversal") return "failed";
  if (cycleId === null) return "topup";
  if (reason === "order_cancelled") return "orderCancelled";
  if (reason === "late_payment") return "latePayment";
  return "order";
}

// What to do when stripe.refunds.create throws. "definitive": Stripe read the
// request and refused it (already refunded, charge too old...), so asking
// again gives the same answer. "retry": anything else, where the refund may
// or may not have reached Stripe; the same idempotency key makes a second
// call safe.
export function classifyRefundError(error: unknown): "definitive" | "retry" {
  const type = (error as { type?: unknown } | null)?.type;
  return type === "StripeInvalidRequestError" || type === "StripeCardError" ? "definitive" : "retry";
}

// Pure rules of pay-per-order (payment mode 'per_order'): what a member pays
// to confirm an order, what a cycle's payments already cover, and what goes
// back when the order is cancelled. Cents throughout; the actions and the
// webhook do the I/O.

import { TOPUP_MIN_CENTS } from "./config";

// Stripe's minimum charge, and a safety ceiling on a single order payment.
export const ORDER_PAYMENT_MIN_CENTS = TOPUP_MIN_CENTS;
export const ORDER_PAYMENT_MAX_CENTS = 100_000;

// The cycle's "handling and order preparation" share: a percentage of the
// products or a fixed amount in the currency unit. An estimate: what is not
// spent goes back to the member when the cycle is settled.
export type HandlingFee = { type: "percent" | "fixed"; value: number };

export type OrderAmount = {
  productsCents: number;
  shippingCents: number;
  feeCents: number;
  // products + shipping + fee
  requiredCents: number;
  // What the member has already paid for this cycle and not got back.
  coveredCents: number;
  // What Stripe charges now; 0 = nothing to pay.
  chargeCents: number;
  outcome: "confirm" | "pay" | "too_high";
};

export function orderPaymentAmount(input: {
  productsCents: number;
  shipping: { mode: string; fixedCents: number | null };
  fee: HandlingFee;
  coveredCents: number;
}): OrderAmount {
  const { productsCents, shipping, fee } = input;
  const hasProducts = productsCents > 0;
  // Proportional (and manual) shipping is only known at the close: the fee
  // covers it until the settlement.
  const shippingCents = hasProducts && shipping.mode === "fixed_per_member" ? (shipping.fixedCents ?? 0) : 0;
  const feeCents = !hasProducts
    ? 0
    : fee.type === "percent"
      ? Math.round((productsCents * fee.value) / 100)
      : Math.round(fee.value * 100);
  const requiredCents = productsCents + shippingCents + feeCents;
  const coveredCents = Math.max(0, input.coveredCents);
  const due = requiredCents - coveredCents;
  if (due <= 0) {
    return { productsCents, shippingCents, feeCents, requiredCents, coveredCents, chargeCents: 0, outcome: "confirm" };
  }
  const chargeCents = Math.max(due, ORDER_PAYMENT_MIN_CENTS);
  return {
    productsCents,
    shippingCents,
    feeCents,
    requiredCents,
    coveredCents,
    chargeCents,
    outcome: chargeCents > ORDER_PAYMENT_MAX_CENTS ? "too_high" : "pay",
  };
}

// Paid for a cycle and not given back: the cycle's order_payment,
// balance_payment, order_refund and refund_failed ledger rows (signed cents),
// minus the refunds asked for and not yet in the ledger, so money on its way
// back is never spent again.
export function coveredCents(movementsCents: ReadonlyArray<number>, requestedRefundsCents: number): number {
  return movementsCents.reduce((sum, c) => sum + c, 0) - requestedRefundsCents;
}

// What a confirmed payment charged for: the lines at the prices paid and the
// breakdown. Stored on payments.order_snapshot; the webhook writes the order
// from it.
export type OrderSnapshot = OrderAmount & {
  lines: { productId: string; quantity: number; unitPriceCents: number }[];
};

export type RefundablePayment = {
  paymentId: string;
  amountCents: number;
  // Refunds Stripe accepted (payments.refunded_cents) and refunds asked for
  // and not yet answered.
  refundedCents: number;
  requestedCents: number;
};

// Cancelling the order gives back what is left of every payment of the cycle.
// The id is deterministic, so a repeated cancel asks for nothing twice.
export function cancelRefunds(
  payments: ReadonlyArray<RefundablePayment>,
): { refundId: string; paymentId: string; amountCents: number }[] {
  return payments
    .map((p) => ({
      refundId: `cancel_${p.paymentId}`,
      paymentId: p.paymentId,
      amountCents: p.amountCents - p.refundedCents - p.requestedCents,
    }))
    .filter((r) => r.amountCents > 0);
}

// The cycle form's fee: "10", "7,5", "1.50". At most two decimals, no sign;
// a percentage at most 100.
export function parseHandlingFee(type: string, value: string): HandlingFee | { error: "invalid" } {
  if (type !== "percent" && type !== "fixed") return { error: "invalid" };
  const trimmed = value.trim();
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(trimmed)) return { error: "invalid" };
  const n = Number(trimmed.replace(",", "."));
  if (type === "percent" && n > 100) return { error: "invalid" };
  return { type, value: n };
}

export const DEFAULT_HANDLING_FEE: HandlingFee = { type: "percent", value: 10 };

// The fee a new cycle gets: none in wallet mode; in per_order what the form
// sent, else the last per_order cycle's, else the default.
export function resolveCycleFee(
  mode: "wallet" | "per_order",
  input: { type: string; value: string } | undefined,
  lastFee: HandlingFee | null,
): { fee: HandlingFee | null } | { error: "invalid" } {
  if (mode === "wallet") return { fee: null };
  if (!input) return { fee: lastFee ?? DEFAULT_HANDLING_FEE };
  const parsed = parseHandlingFee(input.type, input.value);
  return "error" in parsed ? parsed : { fee: parsed };
}

// The lines of the Stripe Checkout page. A first payment shows its breakdown;
// a supplement (something is already paid) is one line. They always add up to
// chargeCents: when Stripe's minimum raised the charge, a single line carries it.
export function checkoutLineItems(
  amount: OrderAmount,
  labels: { products: string; shipping: string; fee: string; supplement: string },
): { name: string; amountCents: number }[] {
  if (amount.coveredCents > 0) return [{ name: labels.supplement, amountCents: amount.chargeCents }];
  if (amount.chargeCents !== amount.requiredCents) return [{ name: labels.products, amountCents: amount.chargeCents }];
  return [
    { name: labels.products, amountCents: amount.productsCents },
    { name: labels.shipping, amountCents: amount.shippingCents },
    { name: labels.fee, amountCents: amount.feeCents },
  ].filter((i) => i.amountCents > 0);
}

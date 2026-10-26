// Pure rules of pay-per-order (payment mode 'per_order'): what a member pays
// to confirm an order, what a cycle's payments already cover, and what goes
// back when the order is cancelled. Cents throughout; the actions and the
// webhook do the I/O.

import { TOPUP_MIN_CENTS } from "./config";

// Stripe's minimum charge, and a safety ceiling on a single order payment.
export const ORDER_PAYMENT_MIN_CENTS = TOPUP_MIN_CENTS;
export const ORDER_PAYMENT_MAX_CENTS = 100_000;

// The cycle's order preparation fee: a percentage of the products or a fixed
// amount per member, in the currency unit. Charged at the close
// (handling_charge) and kept by the group.
export type HandlingFee = { type: "percent" | "fixed"; value: number };

// The highest fee a cycle form accepts: a guard against typos (50 for 5),
// which in wallet mode would only show once the charges are written.
export const HANDLING_FEE_MAX = { percent: 25, fixed: 10 } as const;

// The fee on a member's products, in cents. One rule for the Checkout
// estimate, the close and the summaries (lib/invariants.ts has it in SQL):
// a percentage is taken in hundredths of a percent, so half a cent goes up
// whatever floating point would make of it.
export function handlingFeeCents(productsCents: number, fee: HandlingFee | null): number {
  if (!fee || productsCents <= 0) return 0;
  if (fee.type === "fixed") return Math.round(fee.value * 100);
  const hundredths = Math.round(fee.value * 100);
  return Math.floor((productsCents * hundredths + 5000) / 10000);
}

// A cycle row's fee, null when it has none.
export function cycleHandlingFee(cycle: {
  handlingFeeType?: string | null;
  handlingFeeValue?: string | null;
}): HandlingFee | null {
  if (
    (cycle.handlingFeeType !== "percent" && cycle.handlingFeeType !== "fixed") ||
    cycle.handlingFeeValue == null
  ) {
    return null;
  }
  return { type: cycle.handlingFeeType, value: Number(cycle.handlingFeeValue) };
}

// Whether two fees charge the same: same type and the same value to the cent
// (the database keeps two decimals).
export function sameHandlingFee(a: HandlingFee | null, b: HandlingFee | null): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && Math.round(a.value * 100) === Math.round(b.value * 100);
}

export type OrderAmount = {
  productsCents: number;
  shippingCents: number;
  feeCents: number;
  // products + shipping + fee
  requiredCents: number;
  // What the member has already paid for this cycle and not got back.
  coveredCents: number;
  // What Stripe charges now; 0 = nothing to pay. The order's part plus
  // balanceCents.
  chargeCents: number;
  // With the wallet in card payments (app_settings.card_settles_wallet): the
  // wallet debt this payment pays too, and the wallet credit it uses for the
  // order. 0 without the switch, and never both.
  balanceCents: number;
  walletCreditCents: number;
  outcome: "confirm" | "pay" | "too_high";
};

// The member's wallet as a card payment counts it: the debt (a negative
// balance, all of it) or the credit they can spend (the balance minus their
// wallet orders not charged yet). Both 0 when the group's switch is off.
export type WalletOffset = { debtCents: number; creditCents: number };

export const NO_WALLET_OFFSET: WalletOffset = { debtCents: 0, creditCents: 0 };

// The offset from the wallet balance and the member's wallet orders on other
// open cycles, in cents; nothing when the switch is off.
export function walletOffset(input: {
  enabled: boolean;
  balanceCents: number;
  pendingWalletOrdersCents: number;
}): WalletOffset {
  if (!input.enabled) return NO_WALLET_OFFSET;
  if (input.balanceCents < 0) return { debtCents: -input.balanceCents, creditCents: 0 };
  return { debtCents: 0, creditCents: Math.max(0, input.balanceCents - Math.max(0, input.pendingWalletOrdersCents)) };
}

export function orderPaymentAmount(input: {
  productsCents: number;
  shipping: { mode: string; fixedCents: number | null };
  fee: HandlingFee;
  coveredCents: number;
  wallet?: WalletOffset;
}): OrderAmount {
  const { productsCents, shipping, fee } = input;
  const wallet = input.wallet ?? NO_WALLET_OFFSET;
  const hasProducts = productsCents > 0;
  // Proportional (and manual) shipping is only known at the close: the member
  // pays it at settlement.
  const shippingCents = hasProducts && shipping.mode === "fixed_per_member" ? (shipping.fixedCents ?? 0) : 0;
  const feeCents = handlingFeeCents(productsCents, fee);
  const requiredCents = productsCents + shippingCents + feeCents;
  const coveredCents = Math.max(0, input.coveredCents);
  const base = { productsCents, shippingCents, feeCents, requiredCents, coveredCents };
  const due = requiredCents - coveredCents;
  if (due <= 0) {
    return { ...base, chargeCents: 0, balanceCents: 0, walletCreditCents: 0, outcome: "confirm" };
  }
  // The credit goes first; a debt rides along with any payment.
  let creditCents = Math.min(Math.max(0, wallet.creditCents), due);
  const balanceCents = creditCents > 0 ? 0 : Math.max(0, wallet.debtCents);
  let orderCents = due - creditCents;
  if (orderCents === 0) {
    return { ...base, chargeCents: 0, balanceCents: 0, walletCreditCents: creditCents, outcome: "confirm" };
  }
  // Below Stripe's minimum: use less credit, then charge the order more.
  const short = ORDER_PAYMENT_MIN_CENTS - (orderCents + balanceCents);
  if (short > 0) {
    const fromCredit = Math.min(short, creditCents);
    creditCents -= fromCredit;
    orderCents += short;
  }
  const chargeCents = orderCents + balanceCents;
  return {
    ...base,
    chargeCents,
    balanceCents,
    walletCreditCents: creditCents,
    outcome: chargeCents > ORDER_PAYMENT_MAX_CENTS ? "too_high" : "pay",
  };
}

// Whether Stripe's minimum raised the order's part of the charge above what
// was left to pay.
export function raisedToMinimum(amount: OrderAmount): boolean {
  return (
    amount.outcome === "pay" &&
    amount.chargeCents - amount.balanceCents > amount.requiredCents - amount.coveredCents - amount.walletCreditCents
  );
}

// What a payment of a cycle can give back to the card: the order's part,
// never the wallet debt it paid (that debt was real).
export function orderPartCents(p: { amountCents: number; balanceCents?: number }): number {
  return p.amountCents - (p.balanceCents ?? 0);
}

// Paid for a cycle and not given back: the cycle's order_payment,
// balance_payment, wallet_transfer, order_refund and refund_failed ledger rows (signed cents),
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
  // The part that paid the wallet debt: never refunded with the order.
  balanceCents?: number;
  // Refunds Stripe accepted (payments.refunded_cents) and refunds asked for
  // and not yet answered.
  refundedCents: number;
  requestedCents: number;
};

// Cancelling the order gives back what is left of every payment of the cycle
// (the first cancel of each payment; lib/payments/order-confirm.ts numbers the
// later ones in SQL).
export function cancelRefunds(
  payments: ReadonlyArray<RefundablePayment>,
): { refundId: string; paymentId: string; amountCents: number }[] {
  return payments
    .map((p) => ({
      refundId: `cancel_${p.paymentId}_1`,
      paymentId: p.paymentId,
      amountCents: orderPartCents(p) - p.refundedCents - p.requestedCents,
    }))
    .filter((r) => r.amountCents > 0);
}

// The cycle form's fee: "10", "7,5", "1.50". At most two decimals, no sign, at most HANDLING_FEE_MAX.
export function parseHandlingFee(type: string, value: string): HandlingFee | { error: "invalid" } {
  if (type !== "percent" && type !== "fixed") return { error: "invalid" };
  const trimmed = value.trim();
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(trimmed)) return { error: "invalid" };
  const n = Number(trimmed.replace(",", "."));
  if (n > HANDLING_FEE_MAX[type]) return { error: "invalid" };
  return { type, value: n };
}

export const DEFAULT_HANDLING_FEE: HandlingFee = { type: "percent", value: 10 };

// The fee a cycle gets from its form: "none" (wallet only: a per_order cycle
// always has one, drizzle/0021) or a valid fee. When the form sent nothing:
// the last cycle's of the same mode, else none in wallet mode and 10% per order.
export function resolveCycleFee(
  mode: "wallet" | "per_order",
  input: { type: string; value: string } | undefined,
  lastFee: HandlingFee | null,
): { fee: HandlingFee | null } | { error: "invalid" } {
  if (!input) return { fee: lastFee ?? (mode === "per_order" ? DEFAULT_HANDLING_FEE : null) };
  if (input.type === "none") return mode === "per_order" ? { error: "invalid" } : { fee: null };
  const parsed = parseHandlingFee(input.type, input.value);
  return "error" in parsed ? parsed : { fee: parsed };
}

// The lines of the Stripe Checkout page. A first payment shows its breakdown;
// a supplement (something is already paid) is one line, and so is an order
// part reduced by the wallet credit or raised to Stripe's minimum. A wallet
// debt paid along is its own line. They always add up to chargeCents.
export function checkoutLineItems(
  amount: OrderAmount,
  labels: { products: string; shipping: string; fee: string; supplement: string; afterCredit: string; balance: string },
): { name: string; amountCents: number }[] {
  const orderCents = amount.chargeCents - amount.balanceCents;
  const order =
    amount.coveredCents > 0
      ? [{ name: labels.supplement, amountCents: orderCents }]
      : amount.walletCreditCents > 0
        ? [{ name: labels.afterCredit, amountCents: orderCents }]
        : orderCents !== amount.requiredCents
          ? [{ name: labels.products, amountCents: orderCents }]
          : [
              { name: labels.products, amountCents: amount.productsCents },
              { name: labels.shipping, amountCents: amount.shippingCents },
              { name: labels.fee, amountCents: amount.feeCents },
            ].filter((i) => i.amountCents > 0);
  return amount.balanceCents > 0 ? [...order, { name: labels.balance, amountCents: amount.balanceCents }] : order;
}

// The order's state on Home, for one pay-per-order cycle. `draft` is the
// amount of the unconfirmed edits (orderPaymentAmount on the draft), null
// without a draft.
export type HomeOrderStatus = {
  kind: "draft" | "paid" | "changes" | "changes_no_pay";
  amountCents: number;
} | null;

export function homeOrderStatus(input: {
  hasConfirmedOrder: boolean;
  draft: { chargeCents: number } | null;
  coveredCents: number;
}): HomeOrderStatus {
  const { hasConfirmedOrder, draft, coveredCents } = input;
  if (!hasConfirmedOrder) return draft ? { kind: "draft", amountCents: draft.chargeCents } : null;
  if (!draft) return { kind: "paid", amountCents: coveredCents };
  return draft.chargeCents > 0 ? { kind: "changes", amountCents: draft.chargeCents } : { kind: "changes_no_pay", amountCents: 0 };
}

// The gap between what the confirmed order costs now (products, shipping,
// handling) and what its payments cover. "refund": the member paid more (they
// took something out); it comes back when the cycle is settled. "due": less
// (Stripe's minimum rounding aside, a fee raised after paying); settled too.
export function paidDifference(
  requiredCents: number,
  coveredCents: number,
): { kind: "refund" | "due"; cents: number } | null {
  if (coveredCents === requiredCents) return null;
  return coveredCents > requiredCents
    ? { kind: "refund", cents: coveredCents - requiredCents }
    : { kind: "due", cents: requiredCents - coveredCents };
}

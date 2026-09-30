import { describe, expect, it } from "vitest";
import {
  cancelRefunds,
  checkoutLineItems,
  coveredCents,
  ORDER_PAYMENT_MAX_CENTS,
  orderPaymentAmount,
  parseHandlingFee,
  resolveCycleFee,
} from "./order-payment";

const fixed = { mode: "fixed_per_member", fixedCents: 300 };
const proportional = { mode: "proportional", fixedCents: null };
const pct10 = { type: "percent", value: 10 } as const;

describe("orderPaymentAmount", () => {
  it("adds fixed shipping and a percent fee to the products", () => {
    expect(orderPaymentAmount({ productsCents: 2000, shipping: fixed, fee: pct10, coveredCents: 0 })).toEqual({
      productsCents: 2000,
      shippingCents: 300,
      feeCents: 200,
      requiredCents: 2500,
      coveredCents: 0,
      chargeCents: 2500,
      outcome: "pay",
    });
  });

  it("charges no shipping when it is proportional: the fee covers it", () => {
    const a = orderPaymentAmount({ productsCents: 2000, shipping: proportional, fee: pct10, coveredCents: 0 });
    expect(a.shippingCents).toBe(0);
    expect(a.requiredCents).toBe(2200);
  });

  it("rounds a percent fee to the cent", () => {
    expect(orderPaymentAmount({ productsCents: 1995, shipping: proportional, fee: pct10, coveredCents: 0 }).feeCents).toBe(200);
    expect(orderPaymentAmount({ productsCents: 1994, shipping: proportional, fee: pct10, coveredCents: 0 }).feeCents).toBe(199);
  });

  it("applies a fixed fee only to an order with products", () => {
    const fee = { type: "fixed", value: 1.5 } as const;
    expect(orderPaymentAmount({ productsCents: 1000, shipping: proportional, fee, coveredCents: 0 }).feeCents).toBe(150);
    const empty = orderPaymentAmount({ productsCents: 0, shipping: fixed, fee, coveredCents: 0 });
    expect(empty).toMatchObject({ shippingCents: 0, feeCents: 0, requiredCents: 0, chargeCents: 0, outcome: "confirm" });
  });

  it("asks only for what is not covered yet", () => {
    const a = orderPaymentAmount({ productsCents: 3000, shipping: fixed, fee: pct10, coveredCents: 2500 });
    expect(a).toMatchObject({ requiredCents: 3600, coveredCents: 2500, chargeCents: 1100, outcome: "pay" });
  });

  it("confirms without a payment when the order is already covered", () => {
    const a = orderPaymentAmount({ productsCents: 1000, shipping: fixed, fee: pct10, coveredCents: 2500 });
    expect(a).toMatchObject({ requiredCents: 1400, chargeCents: 0, outcome: "confirm" });
    const exact = orderPaymentAmount({ productsCents: 2000, shipping: fixed, fee: pct10, coveredCents: 2500 });
    expect(exact).toMatchObject({ chargeCents: 0, outcome: "confirm" });
  });

  it("raises a difference under Stripe's minimum to the minimum", () => {
    const a = orderPaymentAmount({ productsCents: 2000, shipping: fixed, fee: pct10, coveredCents: 2490 });
    expect(a).toMatchObject({ chargeCents: 50, outcome: "pay" });
    const atMin = orderPaymentAmount({ productsCents: 2000, shipping: fixed, fee: pct10, coveredCents: 2450 });
    expect(atMin.chargeCents).toBe(50);
  });

  it("refuses a payment above the safety ceiling", () => {
    const a = orderPaymentAmount({ productsCents: ORDER_PAYMENT_MAX_CENTS, shipping: proportional, fee: pct10, coveredCents: 0 });
    expect(a.outcome).toBe("too_high");
    const atMax = orderPaymentAmount({
      productsCents: ORDER_PAYMENT_MAX_CENTS,
      shipping: proportional,
      fee: { type: "fixed", value: 0 },
      coveredCents: 0,
    });
    expect(atMax.outcome).toBe("pay");
  });

  it("never counts a negative coverage as money owed twice", () => {
    // A failed-refund reversal or an odd ledger can leave coverage below zero:
    // the member pays the order, not the order plus the hole.
    const a = orderPaymentAmount({ productsCents: 1000, shipping: proportional, fee: pct10, coveredCents: -500 });
    expect(a).toMatchObject({ coveredCents: 0, chargeCents: 1100 });
  });
});

describe("coveredCents", () => {
  it("sums the cycle's payment and refund movements and subtracts refunds still requested", () => {
    expect(coveredCents([2500, 1100, -600], 0)).toBe(3000);
    expect(coveredCents([2500], 2500)).toBe(0);
    expect(coveredCents([], 0)).toBe(0);
  });
});

describe("cancelRefunds", () => {
  it("refunds what is left of each payment under a deterministic id", () => {
    expect(
      cancelRefunds([
        { paymentId: "pay_1", amountCents: 2500, refundedCents: 0, requestedCents: 0 },
        { paymentId: "pay_2", amountCents: 1100, refundedCents: 400, requestedCents: 0 },
      ]),
    ).toEqual([
      { refundId: "cancel_pay_1", paymentId: "pay_1", amountCents: 2500 },
      { refundId: "cancel_pay_2", paymentId: "pay_2", amountCents: 700 },
    ]);
  });

  it("skips a payment with nothing left, counting refunds still requested", () => {
    expect(
      cancelRefunds([
        { paymentId: "pay_1", amountCents: 2500, refundedCents: 2500, requestedCents: 0 },
        { paymentId: "pay_2", amountCents: 1100, refundedCents: 0, requestedCents: 1100 },
      ]),
    ).toEqual([]);
  });
});

describe("parseHandlingFee", () => {
  it("reads a percentage or a fixed amount with a comma or a dot", () => {
    expect(parseHandlingFee("percent", "10")).toEqual({ type: "percent", value: 10 });
    expect(parseHandlingFee("percent", "7,5")).toEqual({ type: "percent", value: 7.5 });
    expect(parseHandlingFee("fixed", "1.50")).toEqual({ type: "fixed", value: 1.5 });
    expect(parseHandlingFee("fixed", "0")).toEqual({ type: "fixed", value: 0 });
  });

  it("rejects an unknown type, a sign, a blank and a percentage above 100", () => {
    for (const [type, value] of [["other", "10"], ["percent", "-1"], ["percent", ""], ["percent", "101"], ["fixed", "1.234"], ["fixed", "abc"]]) {
      expect(parseHandlingFee(type, value)).toEqual({ error: "invalid" });
    }
  });
});

describe("resolveCycleFee", () => {
  it("gives a wallet cycle no fee, whatever the form sent", () => {
    expect(resolveCycleFee("wallet", { type: "percent", value: "10" }, null)).toEqual({ fee: null });
  });

  it("takes the fee typed in the form of a per_order cycle", () => {
    expect(resolveCycleFee("per_order", { type: "fixed", value: "2" }, null)).toEqual({ fee: { type: "fixed", value: 2 } });
    expect(resolveCycleFee("per_order", { type: "percent", value: "x" }, null)).toEqual({ error: "invalid" });
  });

  it("falls back to the last per_order cycle's fee, then to 10%", () => {
    expect(resolveCycleFee("per_order", undefined, { type: "fixed", value: 3 })).toEqual({ fee: { type: "fixed", value: 3 } });
    expect(resolveCycleFee("per_order", undefined, null)).toEqual({ fee: { type: "percent", value: 10 } });
  });
});

describe("checkoutLineItems", () => {
  const labels = { products: "Products", shipping: "Shipping", fee: "Handling (estimate)", supplement: "Order supplement" };
  const amount = (over: Partial<Parameters<typeof checkoutLineItems>[0]>) => ({
    productsCents: 2000,
    shippingCents: 300,
    feeCents: 200,
    requiredCents: 2500,
    coveredCents: 0,
    chargeCents: 2500,
    outcome: "pay" as const,
    ...over,
  });

  it("itemises a first payment, leaving out what is zero", () => {
    expect(checkoutLineItems(amount({}), labels)).toEqual([
      { name: "Products", amountCents: 2000 },
      { name: "Shipping", amountCents: 300 },
      { name: "Handling (estimate)", amountCents: 200 },
    ]);
    expect(checkoutLineItems(amount({ shippingCents: 0, requiredCents: 2200, chargeCents: 2200 }), labels)).toEqual([
      { name: "Products", amountCents: 2000 },
      { name: "Handling (estimate)", amountCents: 200 },
    ]);
  });

  it("charges a supplement as one line when part of the order is already paid", () => {
    expect(checkoutLineItems(amount({ coveredCents: 1400, chargeCents: 1100 }), labels)).toEqual([
      { name: "Order supplement", amountCents: 1100 },
    ]);
  });

  it("always adds up to what Stripe charges, also when the minimum raised it", () => {
    const tiny = amount({ productsCents: 30, shippingCents: 0, feeCents: 3, requiredCents: 33, chargeCents: 50 });
    const items = checkoutLineItems(tiny, labels);
    expect(items.reduce((s, i) => s + i.amountCents, 0)).toBe(50);
    expect(items).toEqual([{ name: "Products", amountCents: 50 }]);
  });
});

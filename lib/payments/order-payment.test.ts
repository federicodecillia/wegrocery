import { describe, expect, it } from "vitest";
import {
  cancelRefunds,
  checkoutLineItems,
  homeOrderStatus,
  paidDifference,
  coveredCents,
  cycleHandlingFee,
  handlingFeeCents,
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
      { refundId: "cancel_pay_1_1", paymentId: "pay_1", amountCents: 2500 },
      { refundId: "cancel_pay_2_1", paymentId: "pay_2", amountCents: 700 },
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

describe("handlingFeeCents", () => {
  it("takes a percentage of the products, half a cent up, in integers", () => {
    expect(handlingFeeCents(2000, pct10)).toBe(200);
    expect(handlingFeeCents(1005, pct10)).toBe(101); // 100.5
    expect(handlingFeeCents(1004, pct10)).toBe(100); // 100.4
    expect(handlingFeeCents(1000, { type: "percent", value: 1.25 })).toBe(13); // 12.5
    expect(handlingFeeCents(333, { type: "percent", value: 7.5 })).toBe(25); // 24.975
    expect(handlingFeeCents(9_999_999, { type: "percent", value: 25 })).toBe(2_500_000);
  });

  it("charges a fixed amount once per member with products", () => {
    expect(handlingFeeCents(1, { type: "fixed", value: 1.5 })).toBe(150);
    expect(handlingFeeCents(5000, { type: "fixed", value: 0.29 })).toBe(29);
  });

  it("is zero without products or without a fee", () => {
    expect(handlingFeeCents(0, pct10)).toBe(0);
    expect(handlingFeeCents(-100, { type: "fixed", value: 1 })).toBe(0);
    expect(handlingFeeCents(2000, null)).toBe(0);
    expect(handlingFeeCents(2000, { type: "percent", value: 0 })).toBe(0);
  });

  it("is the fee the Checkout estimate shows", () => {
    for (const productsCents of [1, 333, 1004, 1005, 2000, 12_345]) {
      expect(orderPaymentAmount({ productsCents, shipping: fixed, fee: pct10, coveredCents: 0 }).feeCents).toBe(
        handlingFeeCents(productsCents, pct10),
      );
    }
  });
});

describe("cycleHandlingFee", () => {
  it("reads the cycle's columns, null when it has no fee", () => {
    expect(cycleHandlingFee({ handlingFeeType: "fixed", handlingFeeValue: "1.50" })).toEqual({ type: "fixed", value: 1.5 });
    expect(cycleHandlingFee({ handlingFeeType: null, handlingFeeValue: null })).toBeNull();
    expect(cycleHandlingFee({ handlingFeeType: "percent", handlingFeeValue: null })).toBeNull();
    expect(cycleHandlingFee({ handlingFeeType: "other", handlingFeeValue: "1" })).toBeNull();
  });
});

describe("parseHandlingFee", () => {
  it("reads a percentage or a fixed amount with a comma or a dot", () => {
    expect(parseHandlingFee("percent", "10")).toEqual({ type: "percent", value: 10 });
    expect(parseHandlingFee("percent", "7,5")).toEqual({ type: "percent", value: 7.5 });
    expect(parseHandlingFee("fixed", "1.50")).toEqual({ type: "fixed", value: 1.5 });
    expect(parseHandlingFee("fixed", "0")).toEqual({ type: "fixed", value: 0 });
  });

  it("accepts up to 25% or 10 and refuses more: a guard against typos", () => {
    expect(parseHandlingFee("percent", "25")).toEqual({ type: "percent", value: 25 });
    expect(parseHandlingFee("fixed", "10")).toEqual({ type: "fixed", value: 10 });
    expect(parseHandlingFee("percent", "26")).toEqual({ error: "invalid" });
    expect(parseHandlingFee("percent", "25.01")).toEqual({ error: "invalid" });
    expect(parseHandlingFee("fixed", "10.01")).toEqual({ error: "invalid" });
  });

  it("rejects an unknown type, a sign, a blank and a percentage above 100", () => {
    for (const [type, value] of [["other", "10"], ["percent", "-1"], ["percent", ""], ["percent", "101"], ["fixed", "1.234"], ["fixed", "abc"]]) {
      expect(parseHandlingFee(type, value)).toEqual({ error: "invalid" });
    }
  });
});

describe("resolveCycleFee", () => {
  it("gives a wallet cycle the fee of its form, or none", () => {
    expect(resolveCycleFee("wallet", { type: "percent", value: "5" }, null)).toEqual({ fee: { type: "percent", value: 5 } });
    expect(resolveCycleFee("wallet", { type: "none", value: "" }, null)).toEqual({ fee: null });
  });

  it("refuses no fee on a per_order cycle", () => {
    expect(resolveCycleFee("per_order", { type: "none", value: "" }, null)).toEqual({ error: "invalid" });
  });

  it("starts a wallet cycle from the last wallet cycle's fee, else none", () => {
    expect(resolveCycleFee("wallet", undefined, { type: "fixed", value: 1 })).toEqual({ fee: { type: "fixed", value: 1 } });
    expect(resolveCycleFee("wallet", undefined, null)).toEqual({ fee: null });
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

describe("homeOrderStatus", () => {
  const draft = (chargeCents: number) => ({ chargeCents });

  it("shows nothing without an order or a draft", () => {
    expect(homeOrderStatus({ hasConfirmedOrder: false, draft: null, coveredCents: 0 })).toBeNull();
  });

  it("asks to pay a draft that is not an order yet", () => {
    expect(homeOrderStatus({ hasConfirmedOrder: false, draft: draft(2500), coveredCents: 0 })).toEqual({
      kind: "draft",
      amountCents: 2500,
    });
  });

  it("shows a confirmed order as paid, with what was paid", () => {
    expect(homeOrderStatus({ hasConfirmedOrder: true, draft: null, coveredCents: 2500 })).toEqual({
      kind: "paid",
      amountCents: 2500,
    });
  });

  it("tells changes to pay from changes that only need confirming", () => {
    expect(homeOrderStatus({ hasConfirmedOrder: true, draft: draft(1100), coveredCents: 2500 })).toEqual({
      kind: "changes",
      amountCents: 1100,
    });
    expect(homeOrderStatus({ hasConfirmedOrder: true, draft: draft(0), coveredCents: 2500 })).toEqual({
      kind: "changes_no_pay",
      amountCents: 0,
    });
  });
});

describe("paidDifference", () => {
  it("says how much comes back when the member paid more than the order now costs", () => {
    expect(paidDifference(980, 1420)).toEqual({ kind: "refund", cents: 440 });
  });

  it("says nothing when the payments match the order, and flags a shortfall", () => {
    expect(paidDifference(980, 980)).toBeNull();
    expect(paidDifference(1000, 980)).toEqual({ kind: "due", cents: 20 });
  });
});

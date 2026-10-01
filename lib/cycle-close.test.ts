import { describe, expect, it } from "vitest";
import { buildCycleCloseCharges, ordersSnapshot } from "./cycle-close";
import { cancelledCycleReversalTypes } from "./cycle-close";

const fixed = { shippingMode: "fixed_per_member", shippingCostPerMember: "2.00", shippingTotal: null };
const proportional = { shippingMode: "proportional", shippingCostPerMember: null, shippingTotal: "10.00" };
const noShipping = { shippingMode: "fixed_per_member", shippingCostPerMember: null, shippingTotal: null };

describe("buildCycleCloseCharges", () => {
  it("charges each member with a positive order and their shipping share", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "12.50" },
        { memberId: "b", total: "7.25" },
      ],
      fixed,
    );
    expect(r.orderCharges).toEqual([
      { memberId: "a", amount: "-12.50" },
      { memberId: "b", amount: "-7.25" },
    ]);
    expect(r.shippingCharges).toEqual([
      { memberId: "a", amount: "-2.00" },
      { memberId: "b", amount: "-2.00" },
    ]);
    expect(r.summaries).toEqual([
      { memberId: "a", orderTotal: 12.5, shippingShare: 2, handlingShare: 0 },
      { memberId: "b", orderTotal: 7.25, shippingShare: 2, handlingShare: 0 },
    ]);
  });

  it("skips members whose order total is zero", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "0.00" },
        { memberId: "b", total: "5.00" },
      ],
      fixed,
    );
    expect(r.orderCharges.map((c) => c.memberId)).toEqual(["b"]);
    expect(r.shippingCharges.map((c) => c.memberId)).toEqual(["b"]);
  });

  it("writes no shipping rows when the cycle has no shipping", () => {
    const r = buildCycleCloseCharges([{ memberId: "a", total: "5.00" }], noShipping);
    expect(r.orderCharges).toHaveLength(1);
    expect(r.shippingCharges).toEqual([]);
    expect(r.summaries[0].shippingShare).toBe(0);
  });

  it("writes no shipping rows for a manual cycle (distinta handles it)", () => {
    const r = buildCycleCloseCharges([{ memberId: "a", total: "5.00" }], {
      shippingMode: "manual",
      shippingCostPerMember: null,
      shippingTotal: null,
    });
    expect(r.shippingCharges).toEqual([]);
  });

  it("splits proportional shipping to the exact total", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "10.00" },
        { memberId: "c", total: "10.00" },
      ],
      proportional,
    );
    const cents = r.shippingCharges.reduce((s, c) => s + Math.round(-parseFloat(c.amount) * 100), 0);
    expect(cents).toBe(1000);
  });

  it("does not charge twice a member already charged (legacy half-closed cycle)", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "10.00" },
      ],
      fixed,
      { alreadyCharged: { order: new Set(["a"]), shipping: new Set(["a", "b"]), handling: new Set() } },
    );
    expect(r.orderCharges).toEqual([{ memberId: "b", amount: "-10.00" }]);
    expect(r.shippingCharges).toEqual([]);
    // Only newly charged members are notified.
    expect(r.summaries.map((s) => s.memberId)).toEqual(["b"]);
  });

  it("returns nothing for a cycle without orders", () => {
    const r = buildCycleCloseCharges([], fixed);
    expect(r).toEqual({ orderCharges: [], shippingCharges: [], handlingCharges: [], summaries: [] });
  });
});

const pct10 = { type: "percent", value: 10 } as const;

describe("buildCycleCloseCharges with an order preparation fee", () => {
  it("charges each member with products their fee, rounded like the Checkout estimate", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "12.50" },
        { memberId: "b", total: "10.05" },
      ],
      fixed,
      { fee: pct10 },
    );
    expect(r.handlingCharges).toEqual([
      { memberId: "a", amount: "-1.25" },
      { memberId: "b", amount: "-1.01" },
    ]);
    expect(r.summaries.map((s) => s.handlingShare)).toEqual([1.25, 1.01]);
  });

  it("charges a fixed fee once per member with products, never to an empty order", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "0.00" },
        { memberId: "b", total: "3.00" },
      ],
      noShipping,
      { fee: { type: "fixed", value: 1.5 } },
    );
    expect(r.handlingCharges).toEqual([{ memberId: "b", amount: "-1.50" }]);
  });

  it("writes no fee row without a fee, or when it rounds to zero", () => {
    expect(buildCycleCloseCharges([{ memberId: "a", total: "5.00" }], fixed, { fee: null }).handlingCharges).toEqual([]);
    expect(
      buildCycleCloseCharges([{ memberId: "a", total: "0.40" }], fixed, { fee: { type: "percent", value: 0.01 } })
        .handlingCharges,
    ).toEqual([]);
  });

  it("never charges the fee twice to a member already charged", () => {
    const r = buildCycleCloseCharges(
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "10.00" },
      ],
      fixed,
      { fee: pct10, alreadyCharged: { order: new Set(), shipping: new Set(), handling: new Set(["a"]) } },
    );
    expect(r.handlingCharges).toEqual([{ memberId: "b", amount: "-1.00" }]);
  });
});

describe("ordersSnapshot", () => {
  it("maps every member to the exact total text the DB returned", () => {
    expect(
      ordersSnapshot([
        { memberId: "b", total: "7.25" },
        { memberId: "a", total: "0.00" },
      ]),
    ).toBe('{"b":"7.25","a":"0.00"}');
  });

  it("is an empty object for no orders", () => {
    expect(ordersSnapshot([])).toBe("{}");
  });
});

describe("cancelledCycleReversalTypes", () => {
  it("reverses the whole cycle net of a wallet cycle, shipping aside when it is kept", () => {
    expect(cancelledCycleReversalTypes("wallet", true)).toBeNull();
    expect(cancelledCycleReversalTypes("wallet", false)).toEqual({ exclude: ["shipping_charge"] });
  });

  it("reverses only the charges and corrections of a pay-per-order cycle, never payments or refunds", () => {
    expect(cancelledCycleReversalTypes("per_order", true)).toEqual({
      include: ["order_charge", "shipping_charge", "handling_charge", "correction"],
    });
    expect(cancelledCycleReversalTypes("per_order", false)).toEqual({
      include: ["order_charge", "handling_charge", "correction"],
    });
  });

  it("gives the order preparation fee back even when the group keeps the shipping", () => {
    const wallet = cancelledCycleReversalTypes("wallet", false);
    expect(wallet && "exclude" in wallet ? wallet.exclude : []).not.toContain("handling_charge");
  });
});

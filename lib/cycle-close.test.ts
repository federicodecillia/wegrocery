import { describe, expect, it } from "vitest";
import { buildCycleCloseCharges, ordersSnapshot } from "./cycle-close";

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
      { memberId: "a", orderTotal: 12.5, shippingShare: 2 },
      { memberId: "b", orderTotal: 7.25, shippingShare: 2 },
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
      { order: new Set(["a"]), shipping: new Set(["a", "b"]) },
    );
    expect(r.orderCharges).toEqual([{ memberId: "b", amount: "-10.00" }]);
    expect(r.shippingCharges).toEqual([]);
    // Only newly charged members are notified.
    expect(r.summaries.map((s) => s.memberId)).toEqual(["b"]);
  });

  it("returns nothing for a cycle without orders", () => {
    const r = buildCycleCloseCharges([], fixed);
    expect(r).toEqual({ orderCharges: [], shippingCharges: [], summaries: [] });
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

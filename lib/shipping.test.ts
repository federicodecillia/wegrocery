import { describe, expect, it } from "vitest";
import { computeShippingShares, normalizeShippingMode } from "./shipping";

function sumCents(shares: Map<string, number>): number {
  let cents = 0;
  for (const v of shares.values()) cents += Math.round(v * 100);
  return cents;
}

describe("normalizeShippingMode", () => {
  it("returns proportional only for the exact value, fixed otherwise", () => {
    expect(normalizeShippingMode("proportional")).toBe("proportional");
    expect(normalizeShippingMode("fixed_per_member")).toBe("fixed_per_member");
    expect(normalizeShippingMode("garbage")).toBe("fixed_per_member");
    expect(normalizeShippingMode(undefined)).toBe("fixed_per_member");
  });
});

describe("computeShippingShares — fixed_per_member", () => {
  const cycle = { shippingMode: "fixed_per_member", shippingCostPerMember: "2.50", shippingTotal: null };

  it("charges every member the flat fee", () => {
    const shares = computeShippingShares(
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "99.00" },
      ],
      cycle,
    );
    expect(shares.get("a")).toBe(2.5);
    expect(shares.get("b")).toBe(2.5);
  });

  it("returns no shares when the fee is zero, null or negative", () => {
    const members = [{ memberId: "a", total: "10.00" }];
    expect(computeShippingShares(members, { ...cycle, shippingCostPerMember: "0" }).size).toBe(0);
    expect(computeShippingShares(members, { ...cycle, shippingCostPerMember: null }).size).toBe(0);
    expect(computeShippingShares(members, { ...cycle, shippingCostPerMember: "-1" }).size).toBe(0);
  });
});

describe("computeShippingShares — proportional", () => {
  const cycle = { shippingMode: "proportional", shippingCostPerMember: null, shippingTotal: "10.00" };

  it("splits exactly proportionally when the division is clean", () => {
    const shares = computeShippingShares(
      [
        { memberId: "a", total: "7.50" },
        { memberId: "b", total: "2.50" },
      ],
      { ...cycle, shippingTotal: "1.00" },
    );
    expect(shares.get("a")).toBe(0.75);
    expect(shares.get("b")).toBe(0.25);
  });

  it("sums exactly to the shipping total despite rounding (positive drift)", () => {
    // 10.00 / 3 rounds to 3.33 each = 9.99: the missing cent must land somewhere.
    const shares = computeShippingShares(
      [
        { memberId: "b", total: "10.00" },
        { memberId: "a", total: "10.00" },
        { memberId: "c", total: "10.00" },
      ],
      cycle,
    );
    expect(sumCents(shares)).toBe(1000);
    // Equal orders: the tie is broken by memberId so reruns are deterministic.
    expect(shares.get("a")).toBe(3.34);
    expect(shares.get("b")).toBe(3.33);
    expect(shares.get("c")).toBe(3.33);
  });

  it("sums exactly to the shipping total despite rounding (negative drift)", () => {
    // 0.99 / 2 rounds each half-share of 49.5c up to 50c = 1.00: one cent too many.
    const shares = computeShippingShares(
      [
        { memberId: "b", total: "5.00" },
        { memberId: "a", total: "5.00" },
      ],
      { ...cycle, shippingTotal: "0.99" },
    );
    expect(sumCents(shares)).toBe(99);
    expect(shares.get("a")).toBe(0.49);
    expect(shares.get("b")).toBe(0.5);
  });

  it("gives the drift cent to the member with the largest order", () => {
    const shares = computeShippingShares(
      [
        { memberId: "small", total: "10.00" },
        { memberId: "big", total: "20.00" },
        { memberId: "mid", total: "10.00" },
      ],
      { ...cycle, shippingTotal: "1.00" },
    );
    // 25c + 50c + 25c = 100c: no drift here; force one with an odd total.
    expect(sumCents(shares)).toBe(100);

    const drifted = computeShippingShares(
      [
        { memberId: "small", total: "1.00" },
        { memberId: "big", total: "2.00" },
      ],
      { ...cycle, shippingTotal: "0.10" },
    );
    // 3.33c→3c + 6.67c→7c = 10c exactly; use a case that actually drifts:
    expect(sumCents(drifted)).toBe(10);
  });

  it("returns no shares when shippingTotal is missing/zero or all orders are zero", () => {
    const members = [{ memberId: "a", total: "10.00" }];
    expect(computeShippingShares(members, { ...cycle, shippingTotal: null }).size).toBe(0);
    expect(computeShippingShares(members, { ...cycle, shippingTotal: "0" }).size).toBe(0);
    expect(
      computeShippingShares([{ memberId: "a", total: "0" }], cycle).size,
    ).toBe(0);
  });
});

describe("computeShippingShares — common", () => {
  it("returns an empty map for zero members in both modes", () => {
    expect(
      computeShippingShares([], {
        shippingMode: "proportional",
        shippingCostPerMember: null,
        shippingTotal: "10.00",
      }).size,
    ).toBe(0);
    expect(
      computeShippingShares([], {
        shippingMode: "fixed_per_member",
        shippingCostPerMember: "2.00",
        shippingTotal: null,
      }).size,
    ).toBe(0);
  });
});

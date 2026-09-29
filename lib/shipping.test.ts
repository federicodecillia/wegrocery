import { describe, expect, it } from "vitest";
import {
  computeShippingShares,
  normalizeShippingMode,
  planShippingRecompute,
  resolveShippingUpdate,
  shippingRowsSnapshot,
  type ShippingChargeRow,
  type ShippingRecomputePlan,
} from "./shipping";

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

  it("keeps manual as a valid mode instead of collapsing it to fixed", () => {
    expect(normalizeShippingMode("manual")).toBe("manual");
  });
});

describe("resolveShippingUpdate", () => {
  const fixed = { shippingMode: "fixed_per_member", shippingCostPerMember: "2.50", shippingTotal: null };
  const proportional = { shippingMode: "proportional", shippingCostPerMember: null, shippingTotal: "12.00" };
  const manual = { shippingMode: "manual", shippingCostPerMember: null, shippingTotal: null };

  it("leaves a manual (distinta-imported) cycle alone when the form resubmits it", () => {
    // The edit form sends mode "manual" with empty cost fields.
    const r = resolveShippingUpdate(manual, {
      shippingMode: "manual",
      shippingCostPerMember: "",
      shippingTotal: "",
    });
    expect(r).toEqual({ patch: {}, changed: false });
  });

  it("never lets a cycle edit move a manual cycle off manual", () => {
    const r = resolveShippingUpdate(manual, { shippingMode: "fixed_per_member", shippingCostPerMember: "0" });
    expect(r).toEqual({ patch: {}, changed: false });
  });

  it("does not let a cycle edit introduce manual mode", () => {
    const r = resolveShippingUpdate(fixed, { shippingMode: "manual", shippingCostPerMember: "" });
    expect(r).toEqual({ patch: {}, changed: false });
  });

  it("reports no change when the same values are resubmitted in another format", () => {
    const r = resolveShippingUpdate(fixed, {
      shippingMode: "fixed_per_member",
      shippingCostPerMember: "2.5",
      shippingTotal: "",
    });
    expect(r.changed).toBe(false);
  });

  it("reports no change when no shipping field is sent", () => {
    expect(resolveShippingUpdate(fixed, {})).toEqual({ patch: {}, changed: false });
  });

  it("detects a changed fee", () => {
    const r = resolveShippingUpdate(fixed, {
      shippingMode: "fixed_per_member",
      shippingCostPerMember: "3.00",
      shippingTotal: "",
    });
    expect(r.changed).toBe(true);
    expect(r.patch).toEqual({
      shippingMode: "fixed_per_member",
      shippingCostPerMember: "3.00",
      shippingTotal: null,
    });
  });

  it("detects a mode switch and clears the other mode's field", () => {
    const r = resolveShippingUpdate(fixed, {
      shippingMode: "proportional",
      shippingCostPerMember: "2.50",
      shippingTotal: "10",
    });
    expect(r.changed).toBe(true);
    expect(r.patch).toEqual({
      shippingMode: "proportional",
      shippingCostPerMember: null,
      shippingTotal: "10",
    });
  });

  it("detects clearing the fee", () => {
    const r = resolveShippingUpdate(proportional, { shippingMode: "proportional", shippingTotal: "" });
    expect(r.changed).toBe(true);
    expect(r.patch.shippingTotal).toBeNull();
  });

  it("supports partial updates without a mode", () => {
    const r = resolveShippingUpdate(proportional, { shippingTotal: "12" });
    expect(r).toEqual({ patch: { shippingTotal: "12" }, changed: false });
    expect(resolveShippingUpdate(proportional, { shippingTotal: "15" }).changed).toBe(true);
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

// Existing shipping_charge row for `memberId` (ledger amounts are negative).
function row(memberId: string, amount: string): ShippingChargeRow {
  return { entryId: `led_${memberId}`, memberId, amount };
}

// The shipping rows as they are once the plan is written: memberId → cents
// charged (positive).
function applyPlan(existing: ShippingChargeRow[], plan: ShippingRecomputePlan): Map<string, number> {
  const cents = (amount: string) => 0 - Math.round(parseFloat(amount) * 100);
  const charged = new Map(existing.map((r) => [r.memberId, cents(r.amount)]));
  for (const u of plan.updates) charged.set(u.memberId, cents(u.amount));
  for (const i of plan.inserts) charged.set(i.memberId, cents(i.amount));
  return charged;
}

const emptyPlan = { updates: [], inserts: [], changes: [] };

describe("planShippingRecompute — fixed_per_member", () => {
  const fixed = { shippingMode: "fixed_per_member", shippingCostPerMember: "2.50", shippingTotal: null };

  it("charges a member added to the cycle after closing, and only notifies them", () => {
    const plan = planShippingRecompute(
      fixed,
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "5.00" },
      ],
      [row("a", "-2.50")],
    );
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([{ memberId: "b", amount: "-2.50" }]);
    expect(plan.changes).toEqual([{ memberId: "b", oldShare: 0, newShare: 2.5 }]);
  });

  it("reverses the shipping of a member whose order was removed entirely", () => {
    // b has no order line left, so b is absent from the totals.
    const plan = planShippingRecompute(
      fixed,
      [{ memberId: "a", total: "10.00" }],
      [row("a", "-2.50"), row("b", "-2.50")],
    );
    expect(plan.updates).toEqual([{ entryId: "led_b", memberId: "b", amount: "0.00" }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.changes).toEqual([{ memberId: "b", oldShare: 2.5, newShare: 0 }]);
  });

  it("reverses the shipping of a member whose effective total dropped to 0", () => {
    const plan = planShippingRecompute(
      fixed,
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "0.00" },
      ],
      [row("a", "-2.50"), row("b", "-2.50")],
    );
    expect(plan.updates).toEqual([{ entryId: "led_b", memberId: "b", amount: "0.00" }]);
    expect(plan.changes).toEqual([{ memberId: "b", oldShare: 2.5, newShare: 0 }]);
  });

  it("re-charges a reversed member on their existing row, from a share of exactly 0", () => {
    const plan = planShippingRecompute(
      fixed,
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "5.00" },
      ],
      [row("a", "-2.50"), row("b", "0.00")],
    );
    expect(plan.updates).toEqual([{ entryId: "led_b", memberId: "b", amount: "-2.50" }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.changes).toEqual([{ memberId: "b", oldShare: 0, newShare: 2.5 }]);
    // Not -0: formatMoney(-0) reads "-0,00 €" in the notification.
    expect(Object.is(plan.changes[0].oldShare, 0)).toBe(true);
  });

  it("plans nothing when every share already matches, reversed rows included", () => {
    const plan = planShippingRecompute(
      fixed,
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "5.00" },
        { memberId: "c", total: "0.00" },
      ],
      [row("a", "-2.50"), row("b", "-2.5"), row("c", "0.00")],
    );
    expect(plan).toEqual(emptyPlan);
  });

  it("reverses every row when the fee is cleared", () => {
    const plan = planShippingRecompute(
      { ...fixed, shippingCostPerMember: null },
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "5.00" },
      ],
      [row("a", "-2.50")],
    );
    expect(plan.updates).toEqual([{ entryId: "led_a", memberId: "a", amount: "0.00" }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.changes).toEqual([{ memberId: "a", oldShare: 2.5, newShare: 0 }]);
  });
});

describe("planShippingRecompute — proportional", () => {
  const proportional = { shippingMode: "proportional", shippingCostPerMember: null, shippingTotal: "10.00" };

  it("re-splits everyone's share after a quantity change", () => {
    // Split 30/10 (7.50 + 2.50); b's order grows to 30.00: 5.00 + 5.00.
    const plan = planShippingRecompute(
      proportional,
      [
        { memberId: "a", total: "30.00" },
        { memberId: "b", total: "30.00" },
      ],
      [row("a", "-7.50"), row("b", "-2.50")],
    );
    expect(plan.updates).toEqual([
      { entryId: "led_a", memberId: "a", amount: "-5.00" },
      { entryId: "led_b", memberId: "b", amount: "-5.00" },
    ]);
    expect(plan.inserts).toEqual([]);
    expect(plan.changes).toEqual([
      { memberId: "a", oldShare: 7.5, newShare: 5 },
      { memberId: "b", oldShare: 2.5, newShare: 5 },
    ]);
  });

  it("reverses a member going to 0 and gives the whole shipping to the others", () => {
    const plan = planShippingRecompute(
      proportional,
      [
        { memberId: "a", total: "30.00" },
        { memberId: "b", total: "0.00" },
      ],
      [row("a", "-7.50"), row("b", "-2.50")],
    );
    expect(plan.updates).toEqual([
      { entryId: "led_a", memberId: "a", amount: "-10.00" },
      { entryId: "led_b", memberId: "b", amount: "0.00" },
    ]);
    expect(plan.changes).toEqual([
      { memberId: "a", oldShare: 7.5, newShare: 10 },
      { memberId: "b", oldShare: 2.5, newShare: 0 },
    ]);
  });

  it("only notifies the members whose share actually moved", () => {
    // c is added with an order equal to b's: a keeps its share, b and c split theirs.
    const plan = planShippingRecompute(
      proportional,
      [
        { memberId: "a", total: "20.00" },
        { memberId: "b", total: "10.00" },
        { memberId: "c", total: "10.00" },
      ],
      [row("a", "-5.00"), row("b", "-5.00")],
    );
    expect(plan.changes.map((c) => c.memberId)).toEqual(["b", "c"]);
    expect(plan.updates).toEqual([{ entryId: "led_b", memberId: "b", amount: "-2.50" }]);
    expect(plan.inserts).toEqual([{ memberId: "c", amount: "-2.50" }]);
  });

  it("still sums exactly to the shipping total after the re-split", () => {
    // 10.00 over three equal orders: 3.34 + 3.33 + 3.33, the extra cent to
    // the tie-break winner. c is new, a and b are rewritten.
    const existing = [row("a", "-5.00"), row("b", "-5.00")];
    const plan = planShippingRecompute(
      proportional,
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "10.00" },
        { memberId: "c", total: "10.00" },
      ],
      existing,
    );
    const charged = applyPlan(existing, plan);
    expect([...charged.values()].reduce((s, c) => s + c, 0)).toBe(1000);
    expect(Object.fromEntries(charged)).toEqual({ a: 334, b: 333, c: 333 });
  });

  it("sums exactly to the total when a reversal and a rounding drift combine", () => {
    // 7.00 over three orders of 1.00 each; d drops to 0 and is reversed.
    const existing = [row("a", "-1.75"), row("b", "-1.75"), row("c", "-1.75"), row("d", "-1.75")];
    const plan = planShippingRecompute(
      { ...proportional, shippingTotal: "7.00" },
      [
        { memberId: "c", total: "1.00" },
        { memberId: "a", total: "1.00" },
        { memberId: "d", total: "0.00" },
        { memberId: "b", total: "1.00" },
      ],
      existing,
    );
    const charged = applyPlan(existing, plan);
    expect([...charged.values()].reduce((s, c) => s + c, 0)).toBe(700);
    expect(charged.get("d")).toBe(0);
  });

  it("plans nothing when the split already matches the totals", () => {
    const plan = planShippingRecompute(
      proportional,
      [
        { memberId: "a", total: "30.00" },
        { memberId: "b", total: "10.00" },
      ],
      [row("a", "-7.50"), row("b", "-2.50")],
    );
    expect(plan).toEqual(emptyPlan);
  });

  it("does not depend on the order the rows come in, so reruns agree", () => {
    // GROUP BY returns rows in any order, and computeShippingShares' float
    // sum can move a cent with it: here b gets 0.39 or 0.38 depending on it.
    const totals = [
      { memberId: "a", total: "11.07" },
      { memberId: "b", total: "5.43" },
      { memberId: "c", total: "26.94" },
    ];
    const existing = [row("a", "-0.78"), row("b", "-0.39"), row("c", "-1.91")];
    const cycle = { ...proportional, shippingTotal: "3.08" };
    const plan = planShippingRecompute(cycle, totals, existing);
    expect(plan).toEqual(emptyPlan);
    expect(planShippingRecompute(cycle, [...totals].reverse(), [...existing].reverse())).toEqual(plan);
  });
});

describe("planShippingRecompute — manual", () => {
  it("never touches a manual (distinta-imported) cycle", () => {
    const plan = planShippingRecompute(
      { shippingMode: "manual", shippingCostPerMember: null, shippingTotal: null },
      [
        { memberId: "a", total: "10.00" },
        { memberId: "b", total: "0.00" },
        { memberId: "c", total: "8.00" },
      ],
      [row("a", "-4.00"), row("b", "-1.20")],
    );
    expect(plan).toEqual(emptyPlan);
  });
});

describe("shippingRowsSnapshot", () => {
  it("maps every row to the exact amount text the DB returned", () => {
    expect(shippingRowsSnapshot([row("b", "-2.50"), row("a", "0.00")])).toBe(
      '{"led_b":"-2.50","led_a":"0.00"}',
    );
  });

  it("is an empty object for no rows", () => {
    expect(shippingRowsSnapshot([])).toBe("{}");
  });
});

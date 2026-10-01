import { describe, expect, it } from "vitest";
import { closedCycleGrandTotal, closedCycleMemberRows, closedCycleMemberTotal } from "./closed-cycle-totals";

describe("closedCycleMemberTotal", () => {
  it("adds shipping and the order preparation fee to the products", () => {
    expect(closedCycleMemberTotal({ products: 20, shipping: 2.5, handling: 1.2 })).toBe(23.7);
  });

  it("matches the products + shipping total when there is no fee", () => {
    expect(closedCycleMemberTotal({ products: 20, shipping: 2.5, handling: 0 })).toBe(22.5);
  });

  it("does not drift on float sums", () => {
    expect(closedCycleMemberTotal({ products: 0.1, shipping: 0.2, handling: 0 })).toBe(0.3);
  });
});

describe("closedCycleGrandTotal", () => {
  it("sums products, every member's shipping and every member's fee", () => {
    expect(
      closedCycleGrandTotal({
        products: 50,
        shipping: [{ amount: 2.5 }, { amount: 2.5 }],
        handling: [{ amount: 1 }, { amount: 0.75 }],
      }),
    ).toBe(56.75);
  });

  it("is products + shipping when no fee rows exist", () => {
    expect(closedCycleGrandTotal({ products: 50, shipping: [{ amount: 5 }], handling: [] })).toBe(55);
  });
});

describe("closedCycleMemberRows", () => {
  const line = (memberId: string, memberName: string, id: string) => ({ memberId, memberName, id });

  it("groups the order lines by member, in the order they came", () => {
    const rows = closedCycleMemberRows([line("m2", "Bea", "l1"), line("m1", "Ada", "l2"), line("m2", "Bea", "l3")], [], []);
    expect(rows.map((r) => [r.memberId, r.lines.map((l) => l.id)])).toEqual([
      ["m2", ["l1", "l3"]],
      ["m1", ["l2"]],
    ]);
  });

  it("attaches each member's shipping and fee", () => {
    const rows = closedCycleMemberRows(
      [line("m1", "Ada", "l1")],
      [{ memberId: "m1", memberName: "Ada", amount: 2 }],
      [{ memberId: "m1", memberName: "Ada", amount: 0.5 }],
    );
    expect(rows).toEqual([
      { memberId: "m1", memberName: "Ada", lines: [line("m1", "Ada", "l1")], shipping: 2, handling: 0.5 },
    ]);
  });

  it("lists a member charged shipping or a fee who has no order line left", () => {
    const rows = closedCycleMemberRows(
      [line("m1", "Ada", "l1")],
      [{ memberId: "m2", memberName: "Bea", amount: 2 }],
      [{ memberId: "m3", memberName: "Cy", amount: 0.4 }],
    );
    expect(rows.map((r) => [r.memberId, r.lines.length, r.shipping, r.handling])).toEqual([
      ["m1", 1, 0, 0],
      ["m2", 0, 2, 0],
      ["m3", 0, 0, 0.4],
    ]);
  });

  it("keeps two members with the same name apart", () => {
    const rows = closedCycleMemberRows([line("m1", "Ada", "l1"), line("m2", "Ada", "l2")], [], []);
    expect(rows.map((r) => r.memberId)).toEqual(["m1", "m2"]);
  });

  it("sums several rows of the same member without float drift", () => {
    const rows = closedCycleMemberRows(
      [],
      [
        { memberId: "m1", memberName: "Ada", amount: 0.1 },
        { memberId: "m1", memberName: "Ada", amount: 0.2 },
      ],
      [],
    );
    expect(rows[0].shipping).toBe(0.3);
  });

  it("skips a member whose only charges were reversed to zero", () => {
    expect(closedCycleMemberRows([], [{ memberId: "m1", memberName: "Ada", amount: 0 }], [])).toEqual([]);
  });

  it("is empty without orders and without charges", () => {
    expect(closedCycleMemberRows([], [], [])).toEqual([]);
  });
});

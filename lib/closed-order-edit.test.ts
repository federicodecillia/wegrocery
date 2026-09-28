import { describe, expect, it } from "vitest";
import { planClosedOrderEdit, type ExistingOrderLine } from "./closed-order-edit";

function line(partial: Partial<ExistingOrderLine> & { productId: string }): ExistingOrderLine {
  return {
    orderLineId: `ord_${partial.productId}`,
    quantity: 1,
    unitPriceSnapshot: "1.00",
    lineTotal: "1.00",
    actualQuantity: null,
    actualLineTotal: null,
    ...partial,
  };
}

// Beetroot ordered as 2 units at 1.00, weighed at delivery: 1.60.
const weighedBeetroot = line({
  productId: "beet",
  quantity: 2,
  unitPriceSnapshot: "1.00",
  lineTotal: "2.00",
  actualQuantity: "1.600",
  actualLineTotal: "1.60",
});

describe("planClosedOrderEdit", () => {
  it("keeps a weighed line untouched when its quantity does not change", () => {
    const plan = planClosedOrderEdit(
      [weighedBeetroot],
      [
        { productId: "beet", quantity: 2 },
        { productId: "eggs", quantity: 1 },
      ],
      new Map([["eggs", "3.00"]]),
    );
    expect(plan.updates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.inserts).toEqual([
      { productId: "eggs", quantity: 1, unitPrice: "3.00", lineTotal: "3.00" },
    ]);
    // The old total is the effective one (1.60), not the ordered 2.00, so
    // adding eggs charges exactly the eggs and does not undo the weighing.
    expect(plan.oldTotal).toBe(1.6);
    expect(plan.newTotal).toBe(4.6);
    expect(plan.delta).toBe(3);
  });

  it("produces no delta when nothing changes on a weighed order", () => {
    const plan = planClosedOrderEdit(
      [weighedBeetroot],
      [{ productId: "beet", quantity: 2 }],
      new Map([["beet", "9.99"]]),
    );
    expect(plan.delta).toBe(0);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
  });

  it("prices existing lines at their snapshot, not the current product price", () => {
    const plan = planClosedOrderEdit(
      [line({ productId: "apple", quantity: 2, unitPriceSnapshot: "1.50", lineTotal: "3.00" })],
      [{ productId: "apple", quantity: 3 }],
      new Map([["apple", "2.00"]]),
    );
    expect(plan.updates).toEqual([{ orderLineId: "ord_apple", quantity: 3, lineTotal: "4.50" }]);
    expect(plan.delta).toBe(1.5);
  });

  it("resets the actuals of a weighed line whose ordered quantity changes", () => {
    const plan = planClosedOrderEdit(
      [weighedBeetroot],
      [{ productId: "beet", quantity: 3 }],
      new Map(),
    );
    expect(plan.updates).toEqual([{ orderLineId: "ord_beet", quantity: 3, lineTotal: "3.00" }]);
    // From the effective 1.60 to the new ordered 3.00.
    expect(plan.oldTotal).toBe(1.6);
    expect(plan.newTotal).toBe(3);
    expect(plan.delta).toBe(1.4);
  });

  it("deletes removed lines and refunds their effective total", () => {
    const plan = planClosedOrderEdit(
      [weighedBeetroot, line({ productId: "milk", unitPriceSnapshot: "1.20", lineTotal: "1.20" })],
      [{ productId: "milk", quantity: 1 }],
      new Map(),
    );
    expect(plan.deletes).toEqual(["ord_beet"]);
    expect(plan.delta).toBe(-1.6);
  });

  it("treats an empty request as removing the whole order", () => {
    const plan = planClosedOrderEdit([weighedBeetroot], [], new Map());
    expect(plan.deletes).toEqual(["ord_beet"]);
    expect(plan.newTotal).toBe(0);
    expect(plan.delta).toBe(-1.6);
  });

  it("builds an order from scratch for a member with no lines", () => {
    const plan = planClosedOrderEdit([], [{ productId: "eggs", quantity: 2 }], new Map([["eggs", "0.35"]]));
    expect(plan.inserts).toEqual([
      { productId: "eggs", quantity: 2, unitPrice: "0.35", lineTotal: "0.70" },
    ]);
    expect(plan.delta).toBe(0.7);
  });

  it("drops non-positive quantities, floors fractions and merges duplicate products", () => {
    const plan = planClosedOrderEdit(
      [],
      [
        { productId: "eggs", quantity: 1.9 },
        { productId: "eggs", quantity: 2 },
        { productId: "milk", quantity: 0 },
        { productId: "", quantity: 3 },
      ],
      new Map([
        ["eggs", "0.10"],
        ["milk", "1.00"],
      ]),
    );
    expect(plan.inserts).toEqual([
      { productId: "eggs", quantity: 3, unitPrice: "0.10", lineTotal: "0.30" },
    ]);
  });

  it("keeps cents exact where floating point would drift", () => {
    const plan = planClosedOrderEdit([], [{ productId: "x", quantity: 3 }], new Map([["x", "0.10"]]));
    expect(plan.newTotal).toBe(0.3);
    expect(plan.inserts[0].lineTotal).toBe("0.30");
  });

  it("throws when a new product has no price", () => {
    expect(() =>
      planClosedOrderEdit([], [{ productId: "ghost", quantity: 1 }], new Map()),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { closedCycleGrandTotal, closedCycleMemberTotal } from "./closed-cycle-totals";

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

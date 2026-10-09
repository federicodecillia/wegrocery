import { describe, expect, it } from "vitest";
import { deliveredActuals, deliveredTotalFromQuantity, editedOrderPreview } from "./closed-order-preview";

describe("deliveredTotalFromQuantity", () => {
  it("multiplies and rounds to the cent, accepting a comma", () => {
    expect(deliveredTotalFromQuantity("0,8", "3.50")).toBe("2.80");
    expect(deliveredTotalFromQuantity("1.333", "2.99")).toBe("3.99");
    expect(deliveredTotalFromQuantity("0", "5")).toBe("0.00");
  });

  it("leaves the total alone for a bad or negative quantity", () => {
    expect(deliveredTotalFromQuantity("", "3")).toBeNull();
    expect(deliveredTotalFromQuantity("-1", "3")).toBeNull();
    expect(deliveredTotalFromQuantity("abc", "3")).toBeNull();
  });
});

describe("deliveredActuals", () => {
  const ordered = { quantity: 1, lineTotal: "3.50" };

  it("clears the correction when back to what was ordered", () => {
    expect(deliveredActuals("1", "3,50", ordered)).toEqual({ actualQuantity: null, actualLineTotal: null });
    expect(deliveredActuals("1", "3.504", ordered)).toEqual({ actualQuantity: null, actualLineTotal: null });
  });

  it("sends the quantity to 3 decimals and the total to 2", () => {
    expect(deliveredActuals("0,8", "2,8", ordered)).toEqual({ actualQuantity: "0.800", actualLineTotal: "2.80" });
    expect(deliveredActuals("1", "3,20", ordered)).toEqual({ actualQuantity: "1.000", actualLineTotal: "3.20" });
  });

  it("sends null for a field that is not a number", () => {
    expect(deliveredActuals("", "2", ordered)).toEqual({ actualQuantity: null, actualLineTotal: "2.00" });
  });
});

describe("editedOrderPreview", () => {
  it("prices the new quantities and diffs them with the lines on file", () => {
    const products = [
      { productId: "a", unitPrice: "2.50" },
      { productId: "b", unitPrice: "1.10" },
      { productId: "c", unitPrice: "9.99" },
    ];
    const r = editedOrderPreview(products, { a: 2, b: 3, c: 0 }, [{ lineTotal: "5.00" }, { lineTotal: "1.10" }]);
    expect(r.newTotal).toBeCloseTo(8.3, 10);
    expect(r.oldTotal).toBeCloseTo(6.1, 10);
    expect(r.delta).toBeCloseTo(2.2, 10);
  });
});

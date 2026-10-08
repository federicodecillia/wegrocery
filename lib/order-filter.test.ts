import { describe, expect, it } from "vitest";
import { filterOrderProducts } from "./order-filter";

const p = (productId: string, name: string, extra: Partial<{ variant: string; category: string }> = {}) => ({
  productId,
  name,
  variant: extra.variant ?? null,
  format: null,
  category: extra.category ?? null,
  notes: null,
});
const all = [p("a", "Pomodorini", { variant: "Datterino", category: "Verdura" }), p("b", "Mele", { category: "Frutta" }), p("c", "Pane di segale")];

describe("filterOrderProducts", () => {
  it("returns everything for an empty query", () => {
    expect(filterOrderProducts(all, "  ", null)).toHaveLength(3);
  });

  it("matches every word, ignoring case and accents, in any field", () => {
    expect(filterOrderProducts(all, "DATTÉRINO pomo", null).map((x) => x.productId)).toEqual(["a"]);
    expect(filterOrderProducts(all, "frutta", null).map((x) => x.productId)).toEqual(["b"]);
    expect(filterOrderProducts(all, "pane mele", null)).toEqual([]);
  });

  it("keeps only the cart with the chip on", () => {
    expect(filterOrderProducts(all, "", new Set(["b", "c"])).map((x) => x.productId)).toEqual(["b", "c"]);
    expect(filterOrderProducts(all, "pane", new Set(["b"]))).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  flattenGroups,
  groupCycleProducts,
  moveGroup,
  moveIndex,
  moveProduct,
  normalizeProductOrder,
  orderLikePrevious,
  productIdentityKey,
} from "./cycle-order";

type P = { productId: string; name: string; variant: string | null; format: string | null; unit: string | null; category: string | null };

const p = (productId: string, name: string, category: string | null, variant: string | null = null): P => ({
  productId,
  name,
  variant,
  format: null,
  unit: null,
  category,
});

const labels = (groups: { category: string }[]) => groups.map((g) => g.category);

describe("normalizeProductOrder", () => {
  it("is alphabetical unless the cycle says custom", () => {
    expect(normalizeProductOrder("custom")).toBe("custom");
    expect(normalizeProductOrder("alpha")).toBe("alpha");
    expect(normalizeProductOrder(null)).toBe("alpha");
    expect(normalizeProductOrder("whatever")).toBe("alpha");
  });
});

describe("groupCycleProducts", () => {
  const rows = [p("a", "Arance", "Frutta"), p("b", "Bietole", "verdura"), p("c", "Cacio", "Formaggi"), p("d", "Dolce", null), p("e", "Erbette", "Verdura"), p("f", "Farina", "Dispensa")];

  it("alpha: the usual categories first, the others alphabetical, no category last", () => {
    expect(labels(groupCycleProducts(rows, "alpha"))).toEqual(["Frutta", "verdura", "Dispensa", "Formaggi", "Altro"]);
  });

  it("merges categories that differ only in case, keeping the first spelling and the row order", () => {
    const verdura = groupCycleProducts(rows, "alpha").find((g) => g.category === "verdura")!;
    expect(verdura.products.map((x) => x.productId)).toEqual(["b", "e"]);
  });

  it("custom: a category sits where its first product sits", () => {
    const custom = [p("c", "Cacio", "Formaggi"), p("a", "Arance", "Frutta"), p("d", "Dolce", null), p("x", "Mele", "frutta")];
    const groups = groupCycleProducts(custom, "custom");
    expect(labels(groups)).toEqual(["Formaggi", "Frutta", "Altro"]);
    expect(flattenGroups(groups)).toEqual(["c", "a", "x", "d"]);
  });

  it("leaves a list with no categories unlabeled", () => {
    expect(labels(groupCycleProducts([p("a", "A", null), p("b", "B", " ")], "alpha"))).toEqual([""]);
  });
});

describe("moves", () => {
  const groups = groupCycleProducts([p("a", "A", "X"), p("b", "B", "X"), p("c", "C", "Y")], "custom");

  it("moves a product inside its category only", () => {
    expect(flattenGroups(moveProduct(groups, "b", -1))).toEqual(["b", "a", "c"]);
    expect(flattenGroups(moveProduct(groups, "b", 1))).toEqual(["a", "b", "c"]);
    expect(flattenGroups(moveProduct(groups, "c", -1))).toEqual(["a", "b", "c"]);
  });

  it("moves a whole category", () => {
    expect(flattenGroups(moveGroup(groups, 1, -1))).toEqual(["c", "a", "b"]);
    expect(flattenGroups(moveGroup(groups, 0, -1))).toEqual(["a", "b", "c"]);
  });

  it("moveIndex leaves the list alone out of range", () => {
    expect(moveIndex([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveIndex([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
    expect(moveIndex([1, 2, 3], -1, 0)).toEqual([1, 2, 3]);
  });
});

describe("productIdentityKey", () => {
  it("ignores case and spaces", () => {
    expect(productIdentityKey({ name: " Mela ", variant: "Bio", format: null, unit: null })).toBe(
      productIdentityKey({ name: "mela", variant: "bio ", format: "", unit: null }),
    );
  });
});

describe("orderLikePrevious", () => {
  it("keeps the old places, puts new products at the end of their category and new categories last", () => {
    const previous = [p("o1", "Zucca", "Verdura"), p("o2", "Mele", "Frutta"), p("o3", "Carote", "Verdura"), p("o4", "Pere", "Frutta")];
    const current = [
      p("n1", "Bietole", "Verdura"),
      p("n2", "Carote", "verdura"),
      p("n3", "Formaggio", "Latticini"),
      p("n4", "Mele", "Frutta"),
      p("n5", "Pere", "Frutta"),
      p("n6", "Zucca", "Verdura"),
    ];
    expect(orderLikePrevious(current, previous)).toEqual(["n6", "n2", "n1", "n4", "n5", "n3"]);
  });

  it("with nothing in common, keeps the given order by category", () => {
    const current = [p("a", "A", "X"), p("b", "B", "Y"), p("c", "C", "X")];
    expect(orderLikePrevious(current, [])).toEqual(["a", "c", "b"]);
  });
});

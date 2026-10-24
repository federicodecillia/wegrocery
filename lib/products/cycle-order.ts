import { normalizeCategory } from "@/lib/utils";

// How the members see the products of a cycle (order_cycles.product_order,
// drizzle/0040_cycle_product_order.sql). 'alpha', the default: by category,
// then alphabetical (getCycleProducts sorts the rows). 'custom': the order an
// admin chose in Admin → Ciclo → Prodotti, stored in products.sort_order.
// Pure: the order form, the admin's order sheet and the admin list share it.
export type ProductOrderMode = "alpha" | "custom";

export function normalizeProductOrder(value: string | null | undefined): ProductOrderMode {
  return value === "custom" ? "custom" : "alpha";
}

// Alphabetical cycles put these categories first (normalized), the others
// after them in alphabetical order and the products with no category last.
// A custom order ignores the list.
const ALPHA_CATEGORY_FIRST = ["frutta", "verdura", "insalate"];

/** The label of the products with no category, when other categories exist. */
export const OTHER_CATEGORY = "Altro";

export type ProductGroup<T> = { category: string; products: T[] };

/**
 * The products of a cycle in sections by category, in the order the members
 * see them. `products` must come sorted (getCycleProducts): products keep
 * that order inside their section. In 'custom' a section sits where its first
 * product sits. Categories are compared case-insensitively; the first-seen
 * spelling is the label.
 */
export function groupCycleProducts<T extends { category: string | null }>(
  products: readonly T[],
  mode: ProductOrderMode,
): ProductGroup<T>[] {
  const groups = new Map<string, { label: string; products: T[] }>();
  for (const p of products) {
    const label = p.category?.trim() || "";
    const key = normalizeCategory(label);
    const group = groups.get(key);
    if (group) group.products.push(p);
    else groups.set(key, { label, products: [p] });
  }
  const keys = Array.from(groups.keys());
  if (mode === "alpha") {
    const rank = (k: string) => {
      if (k === "") return 1000;
      const i = ALPHA_CATEGORY_FIRST.indexOf(k);
      return i === -1 ? 99 : i;
    };
    keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }
  // With other categories, the products with none get a header of their own
  // instead of a silent unlabeled section.
  const hasNamedGroups = keys.some((k) => k !== "");
  return keys.map((k) => ({
    category: k === "" && hasNamedGroups ? OTHER_CATEGORY : groups.get(k)!.label,
    products: groups.get(k)!.products,
  }));
}

/** The product ids of `groups`, top to bottom: the order to save. */
export function flattenGroups<T extends { productId: string }>(groups: readonly ProductGroup<T>[]): string[] {
  return groups.flatMap((g) => g.products.map((p) => p.productId));
}

/** Moves a product one place up (-1) or down (+1) inside its section. */
export function moveProduct<T extends { productId: string }>(
  groups: readonly ProductGroup<T>[],
  productId: string,
  delta: -1 | 1,
): ProductGroup<T>[] {
  return groups.map((g) => {
    const i = g.products.findIndex((p) => p.productId === productId);
    if (i === -1) return g;
    return { ...g, products: moveIndex(g.products, i, i + delta) };
  });
}

/** Moves the section at `index` one place up (-1) or down (+1). */
export function moveGroup<T>(groups: readonly ProductGroup<T>[], index: number, delta: -1 | 1): ProductGroup<T>[] {
  return moveIndex(groups, index, index + delta);
}

/** `items` with the one at `from` moved to `to`; unchanged when either is out of range. */
export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

type IdentityFields = {
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
};

/**
 * The identity of a product across cycles and imports: name, variant, format
 * and unit, trimmed and case-insensitive (the same key as the
 * products_cycle_identity_uniq index).
 */
export function productIdentityKey(p: IdentityFields): string {
  const part = (v: string | null) => v?.toLowerCase().trim() || "";
  return `${p.name.toLowerCase().trim()}|${part(p.variant)}|${part(p.format)}|${part(p.unit)}`;
}

/**
 * "Usa l'ordine dell'ultimo ciclo": `current` (sorted alphabetically) laid
 * out like `previous` (that cycle's products in their order). A product of
 * both takes its old place; a new one goes to the end of its section, and a
 * section with only new products after the others. Returns the ids to save.
 */
export function orderLikePrevious<T extends IdentityFields & { productId: string; category: string | null }>(
  current: readonly T[],
  previous: readonly IdentityFields[],
): string[] {
  const rank = new Map<string, number>();
  previous.forEach((p, i) => {
    const key = productIdentityKey(p);
    if (!rank.has(key)) rank.set(key, i);
  });
  const ranked = current
    .map((p, i) => ({ p, i, r: rank.get(productIdentityKey(p)) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
  return flattenGroups(groupCycleProducts(ranked, "custom"));
}

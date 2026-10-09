import { normalizeText } from "@/lib/guide/search";

// The order page's search ("Cerca prodotto") and "Nel carrello" chip:
// pure, so the filter is tested without a browser.

/** The search box appears from this many products up. */
export const ORDER_SEARCH_MIN_PRODUCTS = 15;

type Searchable = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  category: string | null;
  notes: string | null;
};

/**
 * Products matching every word of `query` (accents and case ignored) in name,
 * variant, format, category or notes; with `inCart`, only those it holds.
 */
export function filterOrderProducts<P extends Searchable>(
  products: P[],
  query: string,
  inCart: ReadonlySet<string> | null,
): P[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  return products.filter((p) => {
    if (inCart && !inCart.has(p.productId)) return false;
    if (words.length === 0) return true;
    const text = normalizeText([p.name, p.variant, p.format, p.category, p.notes].filter(Boolean).join(" "));
    return words.every((w) => text.includes(w));
  });
}

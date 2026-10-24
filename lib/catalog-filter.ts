import { normalizeText } from "@/lib/guide/search";

// The search box of admin → Catalogo: pure, so the filter is tested without
// a browser. Same matching as the order page (lib/order-filter.ts), plus the
// supplier's name.

type Searchable = {
  name: string;
  variant: string | null;
  format: string | null;
  category: string | null;
  notes: string | null;
  supplierName: string;
};

/** Products matching every word of `query` (accents and case ignored). */
export function filterCatalogProducts<P extends Searchable>(products: P[], query: string): P[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return products;
  return products.filter((p) => {
    const text = normalizeText(
      [p.name, p.variant, p.format, p.category, p.notes, p.supplierName].filter(Boolean).join(" "),
    );
    return words.every((w) => text.includes(w));
  });
}

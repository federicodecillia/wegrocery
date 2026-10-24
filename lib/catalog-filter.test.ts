import { describe, expect, it } from "vitest";
import { filterCatalogProducts } from "./catalog-filter";

const product = (name: string, extra: Partial<Parameters<typeof filterCatalogProducts>[0][number]> = {}) => ({
  name,
  variant: null,
  format: null,
  category: null,
  notes: null,
  supplierName: "Fornitore",
  ...extra,
});

describe("filterCatalogProducts", () => {
  const products = [
    product("Pesto alle mandorle - 90 g", { category: "Conserve" }),
    product("Passata di Pomodoro Bio - 710 g", { supplierName: "Galline Felici" }),
    product("Caffè macinato", { variant: "Arabica" }),
  ];

  it("returns everything for an empty query", () => {
    expect(filterCatalogProducts(products, "  ")).toHaveLength(3);
  });

  it("matches every word, ignoring case and accents", () => {
    expect(filterCatalogProducts(products, "PESTO mandorle").map((p) => p.name)).toEqual([
      "Pesto alle mandorle - 90 g",
    ]);
    expect(filterCatalogProducts(products, "caffe arabica")).toHaveLength(1);
  });

  it("searches the supplier and the category too", () => {
    expect(filterCatalogProducts(products, "galline")).toHaveLength(1);
    expect(filterCatalogProducts(products, "conserve")).toHaveLength(1);
  });

  it("finds nothing when one word is missing", () => {
    expect(filterCatalogProducts(products, "pesto pomodoro")).toHaveLength(0);
  });
});

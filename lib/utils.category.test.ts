import { describe, expect, it } from "vitest";
import {
  canonicalizeCategory,
  guessProductCategory,
  isGenericCategoryLabel,
  normalizeCategory,
} from "./utils";

describe("normalizeCategory", () => {
  it("folds case and whitespace", () => {
    expect(normalizeCategory(" Verdura ")).toBe("verdura");
    expect(normalizeCategory("VERDURA")).toBe("verdura");
    expect(normalizeCategory(null)).toBe("");
    expect(normalizeCategory(undefined)).toBe("");
  });
});

describe("canonicalizeCategory", () => {
  const known = ["Frutta", "Verdura", "Pane e cereali"];
  it("returns the known spelling on a case-insensitive match", () => {
    expect(canonicalizeCategory("verdura", known)).toBe("Verdura");
    expect(canonicalizeCategory(" VERDURA ", known)).toBe("Verdura");
  });
  it("keeps the trimmed input when unknown", () => {
    expect(canonicalizeCategory(" Surgelati ", known)).toBe("Surgelati");
    expect(canonicalizeCategory("", known)).toBe("");
  });
});

describe("guessProductCategory", () => {
  it("puts seafood before meat so shellfish don't fall into Carne", () => {
    expect(guessProductCategory("Gamberi")).toBe("Pesce");
    expect(guessProductCategory("Cozze")).toBe("Pesce");
  });

  it("uses a word boundary on pollo so cipollotto stays Verdura", () => {
    expect(guessProductCategory("Cipollotto fresco")).toBe("Verdura");
    expect(guessProductCategory("Pollo intero")).toBe("Carne");
  });

  it("returns null when nothing matches, instead of guessing wrong", () => {
    expect(guessProductCategory("Prodotto misterioso")).toBeNull();
    expect(guessProductCategory("")).toBeNull();
  });

  it("matches common vegetables regardless of plural form", () => {
    expect(guessProductCategory("Zucchine")).toBe("Verdura");
    expect(guessProductCategory("Zucchina")).toBe("Verdura");
    expect(guessProductCategory("Carote")).toBe("Verdura");
    expect(guessProductCategory("Asparagi")).toBe("Verdura");
    expect(guessProductCategory("Cetrioli")).toBe("Verdura");
  });

  it("matches through descriptive suffixes like 'da trapiantare'", () => {
    expect(guessProductCategory("Basilico viola da trapiantare")).toBeNull(); // herb, not a preset vegetable/fruit
    expect(guessProductCategory("Melanzana nera 500g")).toBe("Verdura");
  });
});

describe("isGenericCategoryLabel", () => {
  it("flags catch-all labels a supplier file uses instead of a real category", () => {
    expect(isGenericCategoryLabel("Altro")).toBe(true);
    expect(isGenericCategoryLabel(" ALTRO ")).toBe(true);
    expect(isGenericCategoryLabel("Varie")).toBe(true);
    expect(isGenericCategoryLabel("Misto")).toBe(true);
  });

  it("does not flag a real category", () => {
    expect(isGenericCategoryLabel("Verdura")).toBe(false);
    expect(isGenericCategoryLabel(null)).toBe(false);
    expect(isGenericCategoryLabel("")).toBe(false);
  });
});

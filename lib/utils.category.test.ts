import { describe, expect, it } from "vitest";
import { canonicalizeCategory, guessProductCategory, normalizeCategory } from "./utils";

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
});

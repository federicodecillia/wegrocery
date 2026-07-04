import { describe, expect, it } from "vitest";
import { canonicalizeCategory, normalizeCategory } from "./utils";

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

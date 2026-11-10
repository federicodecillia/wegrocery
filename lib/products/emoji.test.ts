import { describe, expect, it } from "vitest";
import { isChosenEmoji, productEmojiKey, resolveProductEmoji, rowsWithSameName } from "./emoji";

describe("resolveProductEmoji", () => {
  it("uses the icon the admin picked in the preview first", () => {
    expect(resolveProductEmoji("Gorgonzola dolce", "🍕", "🧀")).toEqual({ emoji: "🍕", source: "override" });
  });

  it("keeps the icon the group already uses over the name match", () => {
    expect(resolveProductEmoji("Mele Fuji", undefined, "🍏")).toEqual({ emoji: "🍏", source: "saved" });
    expect(resolveProductEmoji("Prodotto misterioso", "", "🧀")).toEqual({ emoji: "🧀", source: "saved" });
  });

  it("never treats a saved cart as a choice", () => {
    expect(resolveProductEmoji("Mele Fuji", undefined, "🛒")).toEqual({ emoji: "🍎", source: "name" });
    expect(resolveProductEmoji("Prodotto misterioso", undefined, "🛒")).toEqual({ emoji: "🛒", source: "fallback" });
  });

  it("falls back to the name match, then the cart", () => {
    expect(resolveProductEmoji("Gorgonzola", undefined, undefined).emoji).toBe("🧀");
    expect(resolveProductEmoji("Prodotto misterioso", undefined, null)).toEqual({ emoji: "🛒", source: "fallback" });
  });
});

describe("isChosenEmoji", () => {
  it("is false for empty icons and the cart", () => {
    expect(isChosenEmoji(null)).toBe(false);
    expect(isChosenEmoji(" ")).toBe(false);
    expect(isChosenEmoji("🛒")).toBe(false);
    expect(isChosenEmoji("🧀")).toBe(true);
  });
});

describe("rowsWithSameName", () => {
  const names = ["Gorgonzola", "Pane", " gorgonzola ", "GORGONZOLA", "", ""];

  it("finds every row with the same name, case and spaces aside", () => {
    expect(rowsWithSameName(names, 0)).toEqual([0, 2, 3]);
    expect(rowsWithSameName(names, 1)).toEqual([1]);
  });

  it("does not group rows without a name", () => {
    expect(rowsWithSameName(names, 4)).toEqual([4]);
  });

  it("keys by the trimmed, lower-case name", () => {
    expect(productEmojiKey("  Gorgonzola DOP ")).toBe("gorgonzola dop");
  });
});

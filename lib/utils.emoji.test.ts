import { describe, expect, it } from "vitest";
import { getProductEmoji, getProductEmojiOrNull } from "./utils";

describe("getProductEmoji", () => {
  it("maps melanzana to eggplant, not watermelon", () => {
    expect(getProductEmoji("Melanzana")).toBe("🍆");
    expect(getProductEmoji("Melanzane bio")).toBe("🍆");
  });

  it("still maps anguria and cocomero to watermelon", () => {
    expect(getProductEmoji("Anguria")).toBe("🍉");
    expect(getProductEmoji("Cocomero")).toBe("🍉");
  });

  it("maps riso/risotto to rice, not bread", () => {
    expect(getProductEmoji("Riso Carnaroli")).toBe("🍚");
    expect(getProductEmoji("Risotto ai funghi")).toBe("🍚");
    expect(getProductEmoji("Pane casereccio")).toBe("🍞");
  });

  it("maps peperoni/peperone to bell pepper, not salt", () => {
    expect(getProductEmoji("Peperoni misti")).toBe("🫑");
    expect(getProductEmoji("Peperone rosso")).toBe("🫑");
    expect(getProductEmoji("Peperoncino piccante")).toBe("🌶️");
  });

  it("falls back to the cart emoji for unknown products", () => {
    expect(getProductEmoji("Prodotto misterioso")).toBe("🛒");
  });

  it("returns null (not the fallback) when nothing matches", () => {
    expect(getProductEmojiOrNull("Prodotto misterioso")).toBeNull();
  });
});

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

  it("matches common Italian plurals, not just the singular form", () => {
    expect(getProductEmoji("Mele")).toBe("🍎");
    expect(getProductEmoji("Pere")).toBe("🍐");
    expect(getProductEmoji("Carote")).toBe("🥕");
    expect(getProductEmoji("Zucchine")).toBe("🥒");
    expect(getProductEmoji("Cetrioli")).toBe("🥒");
    expect(getProductEmoji("Broccoli")).toBe("🥦");
    expect(getProductEmoji("Asparagi")).toBe("🌿");
    expect(getProductEmoji("Funghi porcini")).toBe("🍄");
  });

  it("matches aromatic herbs, through compound descriptive names", () => {
    expect(getProductEmoji("Basilico verde genovese")).toBe("🌿");
    expect(getProductEmoji("Basilico viola da trapiantare")).toBe("🌿");
    expect(getProductEmoji("Prezzemolo riccio")).toBe("🌿");
  });

  it("still keeps a dish name matching the dish, not a raw ingredient inside it", () => {
    expect(getProductEmoji("Risotto ai funghi")).toBe("🍚");
  });

  it("covers a few previously-unmapped animal and fruit products", () => {
    expect(getProductEmoji("Pancetta affumicata")).toBe("🥓");
    expect(getProductEmoji("Gamberi rossi")).toBe("🦐");
    expect(getProductEmoji("Calamari freschi")).toBe("🦑");
    expect(getProductEmoji("Mandarino tardivo")).toBe("🍊");
    expect(getProductEmoji("Olive taggiasche")).toBe("🫒");
  });
});

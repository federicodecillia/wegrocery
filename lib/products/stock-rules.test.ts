import { describe, expect, it } from "vitest";
import { fitToStock, isSoldOut, memberCap, parseLimit, parseLimitCell, stockShortages, type ProductStock } from "./stock-rules";

const stock = (s: Partial<ProductStock>): ProductStock => ({
  productId: "p",
  maxQuantity: null,
  maxPerMember: null,
  usedByOthers: 0,
  mine: 0,
  ...s,
});

describe("limited quantities", () => {
  it("caps a member by what the others left and by the cap per member", () => {
    expect(memberCap(stock({}))).toBeNull();
    expect(memberCap(stock({ maxQuantity: 10, usedByOthers: 7 }))).toBe(3);
    expect(memberCap(stock({ maxQuantity: 10, usedByOthers: 7, maxPerMember: 2 }))).toBe(2);
    expect(memberCap(stock({ maxPerMember: 4 }))).toBe(4);
    expect(memberCap(stock({ maxQuantity: 5, usedByOthers: 9 }))).toBe(0);
  });

  it("is sold out when every unit is ordered or reserved", () => {
    expect(isSoldOut(stock({ maxQuantity: 3, usedByOthers: 2, mine: 1 }))).toBe(true);
    expect(isSoldOut(stock({ maxQuantity: 3, usedByOthers: 2 }))).toBe(false);
    expect(isSoldOut(stock({ maxPerMember: 1, mine: 1 }))).toBe(false);
  });

  it("reports only the lines that grow past what is allowed", () => {
    const map = new Map([
      ["a", stock({ productId: "a", maxQuantity: 5, usedByOthers: 3 })],
      ["b", stock({ productId: "b", maxQuantity: 5, usedByOthers: 5, mine: 0 })],
      ["c", stock({ productId: "c", maxQuantity: 2, usedByOthers: 4, mine: 3 })],
    ]);
    const lines = [
      { productId: "a", quantity: 3 },
      { productId: "b", quantity: 1 },
      { productId: "c", quantity: 3 },
      { productId: "free", quantity: 50 },
    ];
    expect(stockShortages(lines, map)).toEqual([
      { productId: "a", requested: 3, allowed: 2 },
      { productId: "b", requested: 1, allowed: 0 },
    ]);
  });

  it("fits the order: short lines come down, sold-out ones go", () => {
    const lines = [
      { productId: "a", quantity: 3, note: "x" },
      { productId: "b", quantity: 1, note: "y" },
      { productId: "c", quantity: 2, note: "z" },
    ];
    expect(
      fitToStock(lines, [
        { productId: "a", requested: 3, allowed: 2 },
        { productId: "b", requested: 1, allowed: 0 },
      ]),
    ).toEqual([
      { productId: "a", quantity: 2, note: "x" },
      { productId: "c", quantity: 2, note: "z" },
    ]);
  });

  it("reads a limit typed by an admin", () => {
    expect(parseLimit("", 0, 99)).toBeNull();
    expect(parseLimit(" 12 ", 0, 99)).toBe(12);
    expect(parseLimit("0", 0, 99)).toBe(0);
    expect(parseLimit("0", 1, 99)).toBe("invalid");
    expect(parseLimit("1.5", 0, 99)).toBe("invalid");
    expect(parseLimit("-1", 0, 99)).toBe("invalid");
    expect(parseLimit("100", 0, 99)).toBe("invalid");
  });
});

describe("parseLimitCell", () => {
  it("reads the leading whole number of a file cell", () => {
    expect(parseLimitCell("30", 0, 99999)).toBe(30);
    expect(parseLimitCell(" 30 pz", 0, 99999)).toBe(30);
    expect(parseLimitCell("30,0", 0, 99999)).toBe(30);
    expect(parseLimitCell("0", 0, 99999)).toBe(0);
  });

  it("is no limit for anything else, never an error", () => {
    for (const raw of ["", "2,5", "circa 30", "-3", "tanti", null, undefined]) expect(parseLimitCell(raw, 0, 99999)).toBeNull();
    expect(parseLimitCell("0", 1, 9999)).toBeNull();
    expect(parseLimitCell("100000", 0, 99999)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { missQuery } from "./search-misses";

describe("missQuery", () => {
  it("keeps a few words, normalized", () => {
    expect(missQuery("  Parcheggio  ")).toBe("parcheggio");
    expect(missQuery("Dov'è il RITIRO?")).toBe("dov e il ritiro");
  });

  it("drops what is too short or too long", () => {
    expect(missQuery("ab")).toBeNull();
    expect(missQuery("x".repeat(61))).toBeNull();
  });

  it("drops anything that could identify someone", () => {
    expect(missQuery("mario.rossi@example.com")).toBeNull();
    expect(missQuery("333 1234567")).toBeNull();
    expect(missQuery("IT60 X054 2811")).toBeNull();
    expect(missQuery("123 456")).toBeNull();
    expect(missQuery("perché il mio saldo di ieri non torna mai")).toBeNull();
  });

  it("keeps short numbers", () => {
    expect(missQuery("ritiro 18")).toBe("ritiro 18");
  });
});

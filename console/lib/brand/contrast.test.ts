import { describe, expect, it } from "vitest";
import { contrastRatio, mixHex, paletteChecks, parseHex, pickOn } from "./contrast";

describe("contrast", () => {
  it("parses hex", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#237032")).toEqual([35, 112, 50]);
    expect(parseHex("red")).toBeNull();
  });

  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(contrastRatio("nope", "#fff")).toBeNaN();
  });

  it("matches a known pair (#767676 on white is 4.54:1)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("picks the readable text colour", () => {
    expect(pickOn("#F5A623")).toBe("#2d2b29");
    expect(pickOn("#1971c2")).toBe("#ffffff");
  });

  it("mixes a soft colour", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("checks a palette", () => {
    const checks = paletteChecks("#237032", "#1971c2");
    expect(checks).toHaveLength(4);
    expect(checks.every((c) => c.passes)).toBe(true);
    expect(paletteChecks("#F5A623", "#00A896").find((c) => c.label.startsWith("Principale come testo"))?.passes).toBe(false);
  });
});

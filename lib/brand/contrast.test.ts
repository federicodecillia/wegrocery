import { describe, it, expect } from "vitest";
import { contrastRatio, darkenToContrast, parseHex, pickOn } from "./contrast";

describe("contrast", () => {
  it("parses #rgb and #rrggbb, rejects the rest", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#F5A623")).toEqual([245, 166, 35]);
    expect(parseHex("rgb(1,2,3)")).toBeNull();
    expect(parseHex("orange")).toBeNull();
  });

  it("computes the WCAG ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#f5a623", "#faf8f5")).toBeCloseTo(1.91, 2);
    expect(contrastRatio("#ffffff", "#f5a623")).toBeCloseTo(2.03, 2);
  });

  it("picks the more readable text colour for a fill", () => {
    expect(pickOn("#f5a623", "#2d2b29")).toBe("#2d2b29");
    expect(pickOn("#1d4ed8", "#2d2b29")).toBe("#ffffff");
  });

  it("darkens a colour until it reaches the ratio on every background", () => {
    const against = ["#faf8f5", "#fef3dc", "#ffffff"];
    const out = darkenToContrast("#f5a623", against);
    for (const bg of against) expect(contrastRatio(out, bg)).toBeGreaterThanOrEqual(4.5);
    const [r, g, b] = parseHex(out)!;
    expect(r).toBeGreaterThan(g); // still an orange, not a grey
    expect(g).toBeGreaterThan(b);
  });

  it("leaves a colour that already passes untouched", () => {
    expect(darkenToContrast("#1d4ed8", ["#ffffff"])).toBe("#1d4ed8");
  });
});

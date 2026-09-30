import { describe, it, expect } from "vitest";
import { contrastRatio } from "./contrast";
import { brandContrastWarnings, deriveRoleVars, resolvePalette } from "./roles";

describe("brand roles", () => {
  it("default palette: every generated text/background pair reaches 4.5", () => {
    const v = deriveRoleVars({});
    expect(contrastRatio(v["--on-primary"], v["--primary"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v["--on-accent"], v["--accent"])).toBeGreaterThanOrEqual(4.5);
    for (const bg of [v["--background"], v["--primary-soft"], "#ffffff"]) {
      expect(contrastRatio(v["--primary-text"], bg)).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of [v["--background"], v["--accent-soft"], "#ffffff"]) {
      expect(contrastRatio(v["--accent-text"], bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(brandContrastWarnings({})).toEqual([]);
  });

  it("keeps the brand fills untouched", () => {
    const v = deriveRoleVars({ primary: "#1d4ed8" });
    expect(v["--primary"]).toBe("#1d4ed8");
    expect(v["--on-primary"]).toBe("#ffffff");
  });

  it("falls back to the default for a non-hex colour and says so", () => {
    expect(resolvePalette({ primary: "rgb(1,2,3)" }).primary).toBe("#f5a623");
    expect(brandContrastWarnings({ primary: "rgb(1,2,3)" })).toEqual([
      expect.stringContaining("theme.primary"),
    ]);
  });

  it("warns when no text colour reaches 4.5 on a fill", () => {
    expect(brandContrastWarnings({ primary: "#1d8fe0" })).toEqual([
      expect.stringContaining("primary"),
    ]);
  });

  it("muted text reads on every light surface of any palette", () => {
    for (const theme of [{}, { primaryLight: "#dbeafe", accentLight: "#ede9fe" }]) {
      const v = deriveRoleVars(theme);
      for (const bg of [v["--background"], v["--primary-soft"], v["--accent-soft"], "#ffffff", "#feecec"]) {
        expect(contrastRatio(v["--muted"], bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("maps background to both surface variables", () => {
    const v = deriveRoleVars({ background: "#ffffff" });
    expect(v["--background"]).toBe("#ffffff");
    expect(v["--warm-wh"]).toBe("#ffffff");
  });
});

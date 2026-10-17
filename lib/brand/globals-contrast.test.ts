import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { contrastRatio } from "./contrast";
import { DEFAULT_PALETTE } from "./roles";

const css = readFileSync("app/globals.css", "utf8");
const v = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{3,6});`, "i").exec(css)?.[1] ?? "";

// The colours in globals.css are not brand-themed, so they are checked
// against the default page background and against white cards.
describe("globals.css constants", () => {
  it("danger text reads on its backgrounds, and the danger fill carries its text", () => {
    for (const bg of [v("--danger-bg"), DEFAULT_PALETTE.background, v("--card")]) {
      expect(contrastRatio(v("--destructive"), bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(v("--danger-foreground"), v("--danger"))).toBeGreaterThanOrEqual(4.5);
  });

  it("warning and success text read on the cards and on their own soft fills", () => {
    for (const role of ["warning", "success"]) {
      for (const bg of [v(`--${role}-bg`), DEFAULT_PALETTE.background, v("--card")]) {
        expect(contrastRatio(v(`--${role}`), bg), `${role} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("defines no brand colour: those come from lib/brand/roles.ts", () => {
    expect(css).not.toMatch(/--(orange|teal)/);
  });
});

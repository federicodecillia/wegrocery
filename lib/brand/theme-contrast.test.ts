import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixHex } from "./contrast";
import { brandContrastWarnings, deriveDarkRoleVars, deriveRoleVars, roleVarsCss } from "./roles";
import type { BrandTheme } from "./types";

// FlyLabs Playbook 2.4: every colour pair the UI relies on, measured on the
// real values in both themes and for several group palettes. Text needs 4.5:1;
// a fill against the surface it sits on, the focus ring and icons need 3:1.
// The light neutrals are read from app/globals.css, the brand-derived tokens
// and the whole dark theme come from lib/brand/roles.ts.

const css = readFileSync("app/globals.css", "utf8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const lightStatic = Object.fromEntries(
  [...rootBlock.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);

const PALETTES: [string, BrandTheme][] = [
  ["default", {}],
  ["example brand", { primary: "#237032", primaryLight: "#ebfbee", accent: "#1971c2", accentLight: "#e7f5ff", background: "#ffffff", frame: "#f1f3f5" }],
  ["light primary", { primary: "#ffe600", primaryLight: "#fffbe0", accent: "#8ce99a", accentLight: "#ebfbee" }],
  ["dark primary", { primary: "#1a1a40", primaryLight: "#e8e8ff", accent: "#5f3dc4", accentLight: "#f3f0ff" }],
  ["mid blue", { primary: "#1d8fe0", accent: "#2f9e44" }],
];

function tokens(theme: BrandTheme, mode: "light" | "dark"): Record<string, string> {
  return mode === "light" ? { ...lightStatic, ...deriveRoleVars(theme) } : { ...lightStatic, ...deriveDarkRoleVars(theme) };
}

/** Text token, surface token, label. The Playbook 2.2 pairs (as in the kit's
 * `tema` module) plus the app's own coloured surfaces. */
function textPairs(mode: "light" | "dark"): [string, string, string][] {
  const surfaces = ["--background", "--card", "--popover"];
  const soft = ["--primary-bg", "--accent-bg", "--danger-bg"];
  const out: [string, string, string][] = [];
  const add = (fg: string, bgs: string[]) => bgs.forEach((bg) => out.push([fg, bg, `${fg} on ${bg}`]));
  add("--foreground", [...surfaces, "--muted", ...soft]);
  add("--card-foreground", ["--card"]);
  add("--popover-foreground", ["--popover"]);
  // Also on the frame: the text under the login card (privacy link, "by flylabs.ai").
  add("--secondary-foreground", [...surfaces, "--secondary", ...soft, "--frame"]);
  add("--muted-foreground", [...surfaces, "--muted", ...soft]);
  add("--primary-text", [...surfaces, "--primary-bg"]);
  add("--accent-text", [...surfaces, "--accent-bg"]);
  add("--destructive", [...surfaces, "--danger-bg"]);
  add("--success", [...surfaces, "--success-bg"]);
  // Warning is a fill in the dark theme (white text on it); text only in light.
  if (mode === "light") add("--warning", [...surfaces, "--warning-bg"]);
  out.push(["--primary-foreground", "--primary", "text on the primary fill"]);
  out.push(["--accent-foreground", "--accent", "text on the accent fill"]);
  out.push(["--danger-foreground", "--danger", "text on the danger fill"]);
  out.push(["--inverse-foreground", "--inverse", "text on the inverse fill"]);
  out.push(["--warning-foreground", "--warning", "text on the warning fill"]);
  return out;
}

/** Control borders and the focus ring on the surfaces they sit on: 3:1. */
const NON_TEXT_PAIRS: [string, string][] = [
  ["--input", "--background"],
  ["--input", "--card"],
  ["--ring", "--background"],
  ["--ring", "--card"],
];

function lightOk(theme: BrandTheme): boolean {
  return brandContrastWarnings(theme).length === 0;
}

describe("theme contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const [name, theme] of PALETTES) {
      if (mode === "light" && !lightOk(theme)) continue; // known to warn: the admin is told in Impostazioni
      it(`${mode} theme, ${name}: text pairs reach 4.5:1`, () => {
        const t = tokens(theme, mode);
        for (const [fg, bg, label] of textPairs(mode)) {
          expect(t[fg], `${fg} defined`).toBeDefined();
          expect(t[bg], `${bg} defined`).toBeDefined();
          expect(contrastRatio(t[fg], t[bg]), label).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${mode} theme, ${name}: coloured text stays readable on a tint of its own fill`, () => {
        const t = tokens(theme, mode);
        for (const role of ["primary", "accent"] as const) {
          for (const base of [t["--background"], t["--card"]]) {
            const tint = mixHex(t[`--${role}`], base, 0.2);
            expect(contrastRatio(t[`--${role}-text`], tint), `${role} text on its tint over ${base}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${mode} theme, ${name}: control borders, the focus ring and the fills reach 3:1 on the surfaces`, () => {
        const t = tokens(theme, mode);
        for (const [fg, bg] of NON_TEXT_PAIRS) {
          expect(t[fg], `${fg} defined`).toBeDefined();
          expect(contrastRatio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
        if (mode === "dark") {
          // In light, the group's own fill is the group's choice (and warned about in Impostazioni).
          for (const role of ["primary", "accent"]) {
            expect(contrastRatio(t[`--${role}`], t["--card"]), `${role} fill on the surface`).toBeGreaterThanOrEqual(3);
          }
        }
      });
    }
  }

  it("the dark theme sets every variable the light one does", () => {
    const light = Object.keys({ ...lightStatic, ...deriveRoleVars({}) });
    const dark = new Set(Object.keys(deriveDarkRoleVars({})));
    // Same on both sides: fills and the warning colour.
    const shared = new Set(["--danger", "--danger-foreground", "--warning", "--warning-foreground"]);
    expect(light.filter((k) => !dark.has(k) && !shared.has(k) && k !== "--nav-h")).toEqual([]);
  });

  it("writes one stylesheet: light on :root, dark when chosen and when the device is dark", () => {
    const sheet = roleVarsCss({});
    expect(sheet).toMatch(/^:root\{--primary:#f5a623/);
    expect(sheet).toContain(':root[data-theme="dark"]{color-scheme:dark;--primary:');
    expect(sheet).toContain('@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;');
    expect(sheet).not.toContain("<");
  });

  it("writes only plain colour values", () => {
    const sheet = roleVarsCss({ primary: "#abc" });
    for (const m of sheet.matchAll(/--[a-z-]+:([^;}]+)/g)) expect(m[1]).toMatch(/^[#a-z0-9(),.% -]+$/i);
  });
});

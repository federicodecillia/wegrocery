import { contrastRatio, darkenToContrast, mixHex, parseHex, pickOn } from "./contrast";
import type { BrandTheme } from "./types";

export type Palette = Required<BrandTheme>;

export const DEFAULT_PALETTE: Palette = {
  primary: "#f5a623",
  primaryLight: "#fef3dc",
  accent: "#00a896",
  accentLight: "#e0f5f3",
  background: "#faf8f5",
  frame: "#ddd8d0",
};

const FOREGROUND = "#2d2b29"; // --foreground in globals.css
const SURFACE = "#ffffff"; // cards are bg-white
const DANGER_SOFT = "#feecec"; // --red-l in globals.css
const MUTED = "#6b6b6b"; // secondary text, darkened further if a soft fill needs it
const AA = 4.5;
const TINT = 0.2; // strongest tint of a fill used behind its own text (bg-primary/20)

/** Every light surface a text token is used on, by palette key for the warnings. */
function textSurfaces(p: Palette, role: "primary" | "accent"): [string, string][] {
  const soft = role === "primary" ? "primaryLight" : "accentLight";
  return [
    ["background", p.background],
    [soft, p[soft]],
    ["cards", SURFACE],
    [`${role} tint on background`, mixHex(p[role], p.background, TINT)],
    [`${role} tint on cards`, mixHex(p[role], SURFACE, TINT)],
  ];
}

function mutedSurfaces(p: Palette): [string, string][] {
  return [
    ["background", p.background],
    ["primaryLight", p.primaryLight],
    ["accentLight", p.accentLight],
    ["cards", SURFACE],
    ["danger background", DANGER_SOFT],
  ];
}

const colours = (surfaces: [string, string][]) => surfaces.map(([, c]) => c);

export function resolvePalette(theme: BrandTheme): Palette {
  const out = { ...DEFAULT_PALETTE };
  for (const k of Object.keys(out) as (keyof Palette)[]) {
    const v = theme[k];
    if (v && parseHex(v)) out[k] = v;
  }
  return out;
}

/** CSS custom properties set on <html>; the only source of brand colours. */
export function deriveRoleVars(theme: BrandTheme): Record<string, string> {
  const p = resolvePalette(theme);
  return {
    "--primary": p.primary,
    "--primary-soft": p.primaryLight,
    "--on-primary": pickOn(p.primary, FOREGROUND),
    "--primary-text": darkenToContrast(p.primary, colours(textSurfaces(p, "primary")), AA),
    "--accent": p.accent,
    "--accent-soft": p.accentLight,
    "--on-accent": pickOn(p.accent, FOREGROUND),
    "--accent-text": darkenToContrast(p.accent, colours(textSurfaces(p, "accent")), AA),
    "--muted": darkenToContrast(MUTED, colours(mutedSurfaces(p)), AA),
    "--background": p.background,
    "--warm-wh": p.background,
    "--frame": p.frame,
  };
}

/** Human-readable problems with the brand palette; empty when it is fine. */
export function brandContrastWarnings(theme: BrandTheme): string[] {
  const warnings: string[] = [];
  for (const k of Object.keys(DEFAULT_PALETTE) as (keyof Palette)[]) {
    const v = theme[k];
    if (v && !parseHex(v)) {
      warnings.push(`theme.${k} "${v}" is not a hex colour (#rgb or #rrggbb): using the default`);
    }
  }
  const v = deriveRoleVars(theme);
  for (const role of ["primary", "accent"] as const) {
    const ratio = contrastRatio(v[`--on-${role}`], v[`--${role}`]);
    if (ratio < AA) {
      warnings.push(`${role} ${v[`--${role}`]}: text on it reaches only ${ratio.toFixed(2)}:1 (needs ${AA}:1)`);
    }
  }
  // Text tokens can only be darkened, so a dark or saturated surface defeats them.
  const p = resolvePalette(theme);
  const checks: [string, [string, string][]][] = [
    ["--primary-text", textSurfaces(p, "primary")],
    ["--accent-text", textSurfaces(p, "accent")],
    ["--muted", mutedSurfaces(p)],
  ];
  for (const [token, surfaces] of checks) {
    for (const [name, colour] of surfaces) {
      const ratio = contrastRatio(v[token], colour);
      if (ratio < AA) {
        warnings.push(`${name} ${colour}: ${token.slice(2)} reaches only ${ratio.toFixed(2)}:1 (needs ${AA}:1)`);
      }
    }
  }
  const bg = contrastRatio(FOREGROUND, v["--background"]);
  if (bg < AA) warnings.push(`background ${v["--background"]}: body text reaches only ${bg.toFixed(2)}:1`);
  return warnings;
}

import { contrastRatio, darkenToContrast, parseHex, pickOn } from "./contrast";
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
const AA = 4.5;

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
    "--primary-text": darkenToContrast(p.primary, [p.background, p.primaryLight, SURFACE], AA),
    "--accent": p.accent,
    "--accent-soft": p.accentLight,
    "--on-accent": pickOn(p.accent, FOREGROUND),
    "--accent-text": darkenToContrast(p.accent, [p.background, p.accentLight, SURFACE], AA),
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
  const bg = contrastRatio(FOREGROUND, v["--background"]);
  if (bg < AA) warnings.push(`background ${v["--background"]}: body text reaches only ${bg.toFixed(2)}:1`);
  return warnings;
}

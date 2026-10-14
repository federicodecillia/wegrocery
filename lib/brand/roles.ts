import { contrastRatio, darkenToContrast, lightenToContrast, mixHex, parseHex, pickOn } from "./contrast";
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
const SURFACE = "#ffffff"; // cards are bg-surface
const DANGER_SOFT = "#feecec"; // --danger-soft in globals.css
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

// The dark theme. The neutrals are the app's own and do not change with the
// group: dark surfaces, light text, a lighter red for text. What the group
// brings is its primary and accent, kept as fills (lightened only when they
// would vanish on a dark surface) and turned into soft fills and readable text.
export const DARK = {
  background: "#161514",
  frame: "#0e0d0d",
  surface: "#201e1c",
  foreground: "#f1eee9",
  gray: "#b9b6b0",
  grayLight: "#6a6762", // fills and disabled states only
  dangerText: "#ff9a9a",
  dangerSoft: "#3b1d1d",
  muted: "#a29f99",
  border: "rgba(255, 255, 255, 0.14)",
} as const;

const DARK_TINT_SOFT = 0.16; // how much of its colour a soft fill takes
const FILL_MIN = 3; // a fill against the surface it sits on (WCAG 1.4.11)

/**
 * The same variables as deriveRoleVars for the dark theme, plus the neutrals
 * that globals.css holds for the light one. Emitted under
 * the dark selectors by roleVarsCss.
 */
export function deriveDarkRoleVars(theme: BrandTheme): Record<string, string> {
  const p = resolvePalette(theme);
  const surfaces = [DARK.background, DARK.surface];
  const primary = lightenToContrast(p.primary, surfaces, FILL_MIN);
  const accent = lightenToContrast(p.accent, surfaces, FILL_MIN);
  const primarySoft = mixHex(primary, DARK.surface, DARK_TINT_SOFT);
  const accentSoft = mixHex(accent, DARK.surface, DARK_TINT_SOFT);
  const textOn = (fill: string, soft: string) => [
    ...surfaces,
    soft,
    mixHex(fill, DARK.background, TINT),
    mixHex(fill, DARK.surface, TINT),
  ];
  return {
    "--primary": primary,
    "--primary-soft": primarySoft,
    "--on-primary": pickOn(primary, DARK.surface),
    "--primary-text": lightenToContrast(primary, textOn(primary, primarySoft), AA),
    "--accent": accent,
    "--accent-soft": accentSoft,
    "--on-accent": pickOn(accent, DARK.surface),
    "--accent-text": lightenToContrast(accent, textOn(accent, accentSoft), AA),
    "--muted": lightenToContrast(DARK.muted, [...surfaces, primarySoft, accentSoft, DARK.dangerSoft], AA),
    "--background": DARK.background,
    "--warm-wh": DARK.background,
    "--frame": DARK.frame,
    "--surface": DARK.surface,
    "--foreground": DARK.foreground,
    "--near-blk": DARK.foreground,
    "--gray": DARK.gray,
    "--gray-l": DARK.grayLight,
    "--border": DARK.border,
    "--danger-text": DARK.dangerText,
    "--danger-soft": DARK.dangerSoft,
    "--inverse": DARK.foreground,
    "--on-inverse": DARK.surface,
    "--tint": "#ffffff",
  };
}

const SAFE_VALUE = /^[#a-z0-9(),.% -]+$/i;

/**
 * The stylesheet that carries the brand's colours: light on :root, dark on
 * :root[data-theme="dark"] and, with no choice made, when the device is dark. Every value is a hex or rgba computed here from
 * validated hex colours; anything else is dropped rather than written.
 */
export function roleVarsCss(theme: BrandTheme): string {
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .filter(([, v]) => SAFE_VALUE.test(v))
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  const dark = `color-scheme:dark;${block(deriveDarkRoleVars(theme))}`;
  // Dark when chosen, and when the device is dark and the choice is not "light".
  return (
    `:root{${block(deriveRoleVars(theme))}}` +
    `:root[data-theme="dark"]{${dark}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}`
  );
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

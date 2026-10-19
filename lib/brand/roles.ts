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
const SURFACE = "#ffffff"; // --card in globals.css
const DANGER_BG = "#feecec"; // --danger-bg in globals.css
const MUTED_BG = "#f3f2f0"; // --muted (and --secondary) in globals.css
const MUTED = "#6b6b6b"; // --muted-foreground, darkened further if a soft fill needs it
const INPUT = "#8a8886"; // --input: control borders, darkened until 3:1 on the page and cards
const NON_TEXT = 3; // control borders, the focus ring, icons (WCAG 1.4.11)
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
    ["muted fill", MUTED_BG],
    ["danger background", DANGER_BG],
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
  const primaryText = darkenToContrast(p.primary, colours(textSurfaces(p, "primary")), AA);
  return {
    "--primary": p.primary,
    "--primary-bg": p.primaryLight,
    "--primary-foreground": pickOn(p.primary, FOREGROUND),
    "--primary-text": primaryText,
    "--ring": primaryText,
    "--accent": p.accent,
    "--accent-bg": p.accentLight,
    "--accent-foreground": pickOn(p.accent, FOREGROUND),
    "--accent-text": darkenToContrast(p.accent, colours(textSurfaces(p, "accent")), AA),
    "--muted-foreground": darkenToContrast(MUTED, colours(mutedSurfaces(p)), AA),
    "--input": darkenToContrast(INPUT, [p.background, SURFACE], NON_TEXT),
    "--background": p.background,
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
  card: "#201e1c",
  foreground: "#f1eee9",
  mutedBg: "#2b2927",
  secondaryForeground: "#b9b6b0",
  neutral: "#6a6762", // fills and disabled states only
  destructive: "#ff9a9a",
  dangerBg: "#3b1d1d",
  warningBg: "#3a2a17",
  success: "#7fd18b",
  successBg: "#1b3221",
  mutedForeground: "#a29f99",
  input: "#7a7772",
  border: "rgba(255, 255, 255, 0.14)",
  // The flylabs.ai logo's dark colours (Playbook 2.11): FlyLabs' own, the
  // same for every group, like the light pair in globals.css.
  flylabsAi: "#7a80ff",
  flylabsSpark: "#ffda47",
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
  const surfaces = [DARK.background, DARK.card];
  const primary = lightenToContrast(p.primary, surfaces, FILL_MIN);
  const accent = lightenToContrast(p.accent, surfaces, FILL_MIN);
  const primaryBg = mixHex(primary, DARK.card, DARK_TINT_SOFT);
  const accentBg = mixHex(accent, DARK.card, DARK_TINT_SOFT);
  const textOn = (fill: string, soft: string) => [
    ...surfaces,
    soft,
    mixHex(fill, DARK.background, TINT),
    mixHex(fill, DARK.card, TINT),
  ];
  const primaryText = lightenToContrast(primary, textOn(primary, primaryBg), AA);
  return {
    "--primary": primary,
    "--primary-bg": primaryBg,
    "--primary-foreground": pickOn(primary, DARK.card),
    "--primary-text": primaryText,
    "--ring": primaryText,
    "--accent": accent,
    "--accent-bg": accentBg,
    "--accent-foreground": pickOn(accent, DARK.card),
    "--accent-text": lightenToContrast(accent, textOn(accent, accentBg), AA),
    "--muted-foreground": lightenToContrast(
      DARK.mutedForeground,
      [...surfaces, primaryBg, accentBg, DARK.mutedBg, DARK.dangerBg],
      AA,
    ),
    "--input": lightenToContrast(DARK.input, surfaces, NON_TEXT),
    "--background": DARK.background,
    "--frame": DARK.frame,
    "--card": DARK.card,
    "--card-foreground": DARK.foreground,
    "--popover": DARK.card,
    "--popover-foreground": DARK.foreground,
    "--foreground": DARK.foreground,
    "--muted": DARK.mutedBg,
    "--secondary": DARK.mutedBg,
    "--secondary-foreground": DARK.secondaryForeground,
    "--neutral": DARK.neutral,
    "--border": DARK.border,
    "--destructive": DARK.destructive,
    "--danger-bg": DARK.dangerBg,
    "--warning-bg": DARK.warningBg,
    "--success": DARK.success,
    "--success-bg": DARK.successBg,
    "--inverse": DARK.foreground,
    "--inverse-foreground": DARK.card,
    "--tint": "#ffffff",
    "--flylabs-ai": DARK.flylabsAi,
    "--flylabs-spark": DARK.flylabsSpark,
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
    const ratio = contrastRatio(v[`--${role}-foreground`], v[`--${role}`]);
    if (ratio < AA) {
      warnings.push(`${role} ${v[`--${role}`]}: text on it reaches only ${ratio.toFixed(2)}:1 (needs ${AA}:1)`);
    }
  }
  // Text tokens can only be darkened, so a dark or saturated surface defeats them.
  const p = resolvePalette(theme);
  const checks: [string, [string, string][]][] = [
    ["--primary-text", textSurfaces(p, "primary")],
    ["--accent-text", textSurfaces(p, "accent")],
    ["--muted-foreground", mutedSurfaces(p)],
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

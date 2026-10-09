// Minimal WCAG 2.1 contrast math, ported from the main app's
// lib/brand/contrast.ts: enough to warn about a palette before an instance
// exists. The full brand editing happens later in the app's own setup.

export type Rgb = [number, number, number];

export function parseHex(value: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio; NaN if either colour is not a hex colour. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return NaN;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text colour for a filled surface: near-black or white, whichever reads better. */
export function pickOn(fill: string, dark = "#2d2b29"): string {
  return contrastRatio(dark, fill) >= contrastRatio("#ffffff", fill) ? dark : "#ffffff";
}

/** `top` at `alpha` over `base`, e.g. a soft background from a fill colour. */
export function mixHex(top: string, base: string, alpha: number): string {
  const t = parseHex(top);
  const b = parseHex(base);
  if (!t || !b) return base;
  return toHex(t.map((v, i) => v * alpha + b[i] * (1 - alpha)) as Rgb);
}

export const AA = 4.5;

export interface ContrastCheck {
  label: string;
  ratio: number;
  passes: boolean;
}

/**
 * What the app will show with these colours: the text on a primary and on an
 * accent button (the app computes it, so it passes unless the colour sits in
 * the middle), and the colour itself as text on white (the app darkens it if
 * needed, so a failure there is only a hint).
 */
export function paletteChecks(primary: string, accent: string): ContrastCheck[] {
  const rows: [string, string, string][] = [
    ["Testo sul pulsante principale", pickOn(primary), primary],
    ["Testo sul pulsante accento", pickOn(accent), accent],
    ["Principale come testo su bianco", primary, "#ffffff"],
    ["Accento come testo su bianco", accent, "#ffffff"],
  ];
  return rows.map(([label, fg, bg]) => {
    const ratio = contrastRatio(fg, bg);
    return { label, ratio, passes: ratio >= AA };
  });
}

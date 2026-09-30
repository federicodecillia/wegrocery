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

/** Text colour for a filled surface: `dark` or white, whichever reads better. */
export function pickOn(fill: string, dark: string): string {
  return contrastRatio(dark, fill) >= contrastRatio("#ffffff", fill) ? dark : "#ffffff";
}

/** Same hue, scaled towards black until it reaches `min` on every background. */
export function darkenToContrast(color: string, against: string[], min = 4.5): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  for (let step = 0; step <= 50; step++) {
    const f = 1 - step * 0.02;
    const candidate = step === 0 ? color : toHex(rgb.map((v) => v * f) as Rgb);
    if (against.every((bg) => contrastRatio(candidate, bg) >= min)) return candidate;
  }
  return "#000000";
}

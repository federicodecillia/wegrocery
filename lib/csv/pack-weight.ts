// Price per kg for supplier listings. Many listings carry no price-per-kg
// column and write the pack weight only in the product name ("cestello da
// 6 kg", "12 x 240 g"), so the import wizard can derive it. Better no value
// than a wrong one: anything ambiguous returns null.

// A price cell as suppliers write it.
export function parsePriceCell(raw: string): number | null {
  if (!raw) return null;
  // tolerate "€ 12,50", "12.50 €", "1.234,56", thin spaces, etc.
  const cleaned = raw
    .replace(/[€\s ]/g, "")
    .replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  // if both "." and "," present, last one is the decimal separator
  let normal = cleaned;
  const lastDot = normal.lastIndexOf(".");
  const lastComma = normal.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      normal = normal.replace(/\./g, "").replace(",", ".");
    } else {
      normal = normal.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normal = normal.replace(",", ".");
  }
  const n = parseFloat(normal);
  return Number.isFinite(n) ? n : null;
}

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kilo|chili|grammi|gr|g)(?![a-z])/g;
const VOLUME_RE = /\d+(?:[.,]\d+)?\s*(?:cl|ml|lt|l)(?![a-z])/;
const MULTIPLIER_RE = /(?<![\d.,])(\d+)\s*[x×](?=\s|\d)/g;

function toNumber(raw: string, unit: string): number {
  // "1.000 g" is a thousand grams, "1,5 kg" one and a half kilos.
  if (unit !== "kg" && unit !== "kilo" && unit !== "chili" && /^\d{1,3}[.,]\d{3}$/.test(raw)) {
    return Number(raw.replace(/[.,]/, ""));
  }
  return Number(raw.replace(",", "."));
}

// Total weight of one pack in kg, read from free text such as a format or a
// product name. Returns null when there is no weight, when the text holds two
// different weights (a size grade like "85-100g" next to "6 kg"), more than
// one multiplier, or a volume.
export function parsePackWeightKg(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.toLowerCase();

  const weights = new Set<number>();
  for (const m of s.matchAll(WEIGHT_RE)) {
    const unit = m[2];
    const value = toNumber(m[1], unit);
    const kg = unit === "kg" || unit === "kilo" || unit === "chili" ? value : value / 1000;
    weights.add(Math.round(kg * 1e6) / 1e6);
  }
  if (weights.size !== 1) return null;
  if (VOLUME_RE.test(s)) return null;

  const multipliers = [...s.matchAll(MULTIPLIER_RE)].map((m) => Number(m[1]));
  if (multipliers.length > 1) return null;

  const total = [...weights][0] * (multipliers[0] ?? 1);
  return Number.isFinite(total) && total > 0 ? total : null;
}

// The format column wins when it states a weight; the name is the fallback.
export function packWeightKg(format: string | null | undefined, name: string): number | null {
  return parsePackWeightKg(format) ?? parsePackWeightKg(name);
}

export type PricePerKgSource = "file" | "computed" | "none";

export type PricePerKgResolution = {
  value: number | null;
  source: PricePerKgSource;
  // The file's value equals the pack price on a pack that is not 1 kg: the
  // price-per-kg column was most likely mapped to the price column.
  suspect: boolean;
};

export function resolvePricePerKg(input: {
  unitPrice: number;
  filePricePerKg: number | null;
  format: string | null;
  name: string;
  computeWhenMissing: boolean;
  replaceSuspect: boolean;
}): PricePerKgResolution {
  const weight = packWeightKg(input.format, input.name);
  const computed = weight != null ? Math.round((input.unitPrice / weight) * 100) / 100 : null;
  const file = input.filePricePerKg;
  const suspect =
    file != null && weight != null && Math.abs(weight - 1) > 1e-9 && Math.abs(file - input.unitPrice) < 0.005;

  if (suspect && input.replaceSuspect) {
    return { value: computed, source: "computed", suspect };
  }
  if (file != null) return { value: file, source: "file", suspect };
  if (input.computeWhenMissing && computed != null) {
    return { value: computed, source: "computed", suspect };
  }
  return { value: null, source: "none", suspect };
}

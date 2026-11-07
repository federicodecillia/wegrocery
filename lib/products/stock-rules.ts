// The pure side of limited quantities (lib/products/stock.ts): what a member
// may hold, what is sold out, which lines are short and how to fit them.
// No database here, so the order form uses it too.

export type StockLine = { productId: string; quantity: number };

/** One limited product of a cycle, as seen by one member. */
export type ProductStock = {
  productId: string;
  maxQuantity: number | null;
  maxPerMember: number | null;
  /** Ordered or reserved by the other members. */
  usedByOthers: number;
  /** This member's confirmed quantity. */
  mine: number;
};

/** The most this member may hold of the product; null = no limit. */
export function memberCap(s: ProductStock): number | null {
  const left = s.maxQuantity === null ? null : Math.max(0, s.maxQuantity - s.usedByOthers);
  if (left === null) return s.maxPerMember;
  return s.maxPerMember === null ? left : Math.min(left, s.maxPerMember);
}

/** Nothing left for anyone to add: every unit is ordered or reserved. */
export function isSoldOut(s: ProductStock): boolean {
  return s.maxQuantity !== null && s.usedByOthers + s.mine >= s.maxQuantity;
}

export type Shortage = { productId: string; requested: number; allowed: number };

/**
 * The lines that ask for more than the member may hold. A line is never short
 * when it does not grow: keeping or trimming what is already confirmed always
 * passes, also when the limits changed under it.
 */
export function stockShortages(lines: readonly StockLine[], stock: ReadonlyMap<string, ProductStock>): Shortage[] {
  const out: Shortage[] = [];
  for (const l of lines) {
    const s = stock.get(l.productId);
    if (!s || l.quantity <= s.mine) continue;
    const cap = memberCap(s);
    if (cap !== null && l.quantity > cap) out.push({ productId: l.productId, requested: l.quantity, allowed: Math.max(cap, s.mine) });
  }
  return out;
}

/** "Adatta alle disponibilità": each short line brought down to what is allowed (0 drops it). */
export function fitToStock<L extends StockLine>(lines: readonly L[], shortages: readonly Shortage[]): L[] {
  const allowed = new Map(shortages.map((s) => [s.productId, s.allowed]));
  return lines
    .map((l) => (allowed.has(l.productId) ? { ...l, quantity: Math.min(l.quantity, allowed.get(l.productId)!) } : l))
    .filter((l) => l.quantity > 0);
}

/** A limit typed by an admin: empty = none; otherwise a whole number in range. */
export function parseLimit(raw: string | null | undefined, min: number, max: number): number | null | "invalid" {
  const v = (raw ?? "").trim();
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return "invalid";
  const n = Number(v);
  return n < min || n > max ? "invalid" : n;
}

/**
 * A limit read from an imported file: "30", "30 pz", "30,0" give 30. Anything
 * else, or out of range, is no limit (null): a bad cell never fails the row.
 */
export function parseLimitCell(raw: string | null | undefined, min: number, max: number): number | null {
  const lead = /^\s*(\d+)(?:[.,]0+)?(?:\s|$)/.exec(raw ?? "");
  const v = lead ? parseLimit(lead[1], min, max) : null;
  return typeof v === "number" ? v : null;
}

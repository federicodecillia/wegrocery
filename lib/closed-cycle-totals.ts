// Totals shown in the admin closed-cycle modal: what the ledger actually
// charged per member (products + shipping + order preparation fee). The
// shipping and fee amounts are read from live ledger rows, never recomputed.

const toCents = (eur: number) => Math.round(eur * 100);

export function closedCycleMemberTotal(parts: {
  products: number;
  shipping: number;
  handling: number;
}): number {
  return (toCents(parts.products) + toCents(parts.shipping) + toCents(parts.handling)) / 100;
}

export function closedCycleGrandTotal(parts: {
  products: number;
  shipping: ReadonlyArray<{ amount: number }>;
  handling: ReadonlyArray<{ amount: number }>;
}): number {
  const sum = (rows: ReadonlyArray<{ amount: number }>) =>
    rows.reduce((s, r) => s + toCents(r.amount), 0);
  return (toCents(parts.products) + sum(parts.shipping) + sum(parts.handling)) / 100;
}

// Admin → Cassa: a member's movements with the ones of the same cycle (its
// charge, shipping, corrections, refunds, card payment) folded into one
// group. Presentation only: the ledger rows are untouched, the group total is
// their sum.

type GroupableEntry = { entryId: string; amount: string; cycleId: string | null };

export type LedgerListItem<E extends GroupableEntry> =
  | { kind: "entry"; entry: E }
  | { kind: "cycle"; cycleId: string; entries: E[]; totalCents: number };

/**
 * Keeps the list order (newest first) and puts each group where its newest
 * movement is. A cycle with a single movement stays a plain row: a group of
 * one only adds a click. Movements without a cycle (top-ups, fees, payouts)
 * are never grouped.
 */
export function groupLedgerByCycle<E extends GroupableEntry>(entries: E[]): LedgerListItem<E>[] {
  const byCycle = new Map<string, E[]>();
  for (const e of entries) {
    if (!e.cycleId) continue;
    const list = byCycle.get(e.cycleId);
    if (list) list.push(e);
    else byCycle.set(e.cycleId, [e]);
  }

  const items: LedgerListItem<E>[] = [];
  const placed = new Set<string>();
  for (const e of entries) {
    const group = e.cycleId ? byCycle.get(e.cycleId) : undefined;
    if (!e.cycleId || !group || group.length < 2) {
      items.push({ kind: "entry", entry: e });
      continue;
    }
    if (placed.has(e.cycleId)) continue;
    placed.add(e.cycleId);
    // Cents, so ten corrections of 0,10 € add up to exactly 1,00 €.
    const totalCents = group.reduce((sum, g) => sum + Math.round(parseFloat(g.amount) * 100), 0);
    items.push({ kind: "cycle", cycleId: e.cycleId, entries: group, totalCents });
  }
  return items;
}

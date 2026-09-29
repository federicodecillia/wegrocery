// Pure shaping of the member's Storico "Ordini" tab, extracted so it can be
// unit tested. Per cycle it sets what the member got (the order lines at
// their effective cost) against what the ledger moved, so the figures of a
// charged cycle add up to the balance:
//   -productsTotal - shipping + corrections === net

type CycleMeta = {
  cycleId: string;
  cycleTitle: string;
  pickupDate: Date | null;
  cycleStatus: string;
  cycleCreatedAt: Date;
};

// One of the member's order lines, with its cycle.
export type HistoryLineRow = CycleMeta & {
  productName: string;
  variant: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  actualQuantity: string | null;
  actualLineTotal: string | null;
  unit: string | null;
  supplierName: string | null;
  productSupplier: string | null;
  category: string | null;
  emoji: string | null;
};

// The member's ledger rows on one cycle: `net` is SUM(amount), `shipping`
// the shipping charged as a positive cost (the ledger stores it negative).
export type HistoryLedgerRow = CycleMeta & {
  net: string;
  shipping: string;
};

export type CycleHistoryLine = {
  productName: string;
  variant: string | null;
  quantity: number;
  unitPrice: number;
  // As ordered. actualLineTotal is the supplier's weighing, null = as ordered.
  lineTotal: number;
  actualQuantity: number | null;
  actualLineTotal: number | null;
  unit: string | null;
  supplierName: string | null;
  category: string | null;
  emoji: string | null;
};

export type CycleHistoryEntry = {
  cycleId: string;
  title: string;
  pickupDate: Date | null;
  status: string;
  lines: CycleHistoryLine[];
  // False while the cycle is open with nothing on the ledger yet (closing
  // posts the charges): the lines are a pending order, not a movement.
  charged: boolean;
  // Costs, positive: the lines at coalesce(actual_line_total, line_total),
  // and the shipping charged.
  productsTotal: number;
  shipping: number;
  // Signed like the ledger (+ = credit to the member): what products and
  // shipping do not explain (a cancellation refund, a manual correction),
  // and the member's net on the cycle, SUM(amount) WHERE cycle_id.
  corrections: number;
  net: number;
};

function toCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : parseFloat(value);
}

// Line rows come ordered by product within each cycle. A cycle can appear in
// either list: one whose lines were all removed after closing still moved
// the balance, so it is listed from the ledger alone.
export function buildCycleHistory(
  lineRows: ReadonlyArray<HistoryLineRow>,
  ledgerRows: ReadonlyArray<HistoryLedgerRow>,
): CycleHistoryEntry[] {
  const cycles = new Map<string, { meta: CycleMeta; lines: CycleHistoryLine[]; productsCents: number }>();
  const cycleOf = (meta: CycleMeta) => {
    let c = cycles.get(meta.cycleId);
    if (!c) {
      c = { meta, lines: [], productsCents: 0 };
      cycles.set(meta.cycleId, c);
    }
    return c;
  };

  for (const row of lineRows) {
    const c = cycleOf(row);
    c.productsCents += toCents(row.actualLineTotal ?? row.lineTotal);
    c.lines.push({
      productName: row.productName,
      variant: row.variant,
      quantity: row.quantity,
      unitPrice: parseFloat(row.unitPrice),
      lineTotal: parseFloat(row.lineTotal),
      actualQuantity: toNumberOrNull(row.actualQuantity),
      actualLineTotal: toNumberOrNull(row.actualLineTotal),
      unit: row.unit,
      supplierName: row.supplierName ?? row.productSupplier,
      category: row.category,
      emoji: row.emoji,
    });
  }
  const ledgerByCycle = new Map<string, HistoryLedgerRow>();
  for (const row of ledgerRows) {
    cycleOf(row);
    ledgerByCycle.set(row.cycleId, row);
  }

  return Array.from(cycles.values())
    .sort((a, b) => b.meta.cycleCreatedAt.getTime() - a.meta.cycleCreatedAt.getTime())
    .map(({ meta, lines, productsCents }) => {
      const ledger = ledgerByCycle.get(meta.cycleId);
      const netCents = ledger ? toCents(ledger.net) : 0;
      const shippingCents = ledger ? toCents(ledger.shipping) : 0;
      const charged = ledger !== undefined || meta.cycleStatus !== "open";
      return {
        cycleId: meta.cycleId,
        title: meta.cycleTitle,
        pickupDate: meta.pickupDate,
        status: meta.cycleStatus,
        lines,
        charged,
        productsTotal: productsCents / 100,
        shipping: shippingCents / 100,
        corrections: charged ? (netCents + productsCents + shippingCents) / 100 : 0,
        net: netCents / 100,
      };
    });
}

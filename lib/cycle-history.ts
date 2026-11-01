// Pure shaping of the member's Storico "Ordini" tab, extracted so it can be
// unit tested. Per cycle it sets what the member got (the order lines at
// their effective cost) against what the ledger moved, so the figures of a
// charged cycle add up to the balance:
//   -productsTotal - shipping - handling + corrections === net
// A pay-per-order cycle adds what the member paid and what went back to the
// card (spec "UI per modalità": pagato, costi, rimborsato, netto):
//   paid - productsTotal - shipping - handling + corrections - refunded === net

import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/i18n/zoned-time";

type CycleMeta = {
  cycleId: string;
  cycleTitle: string;
  pickupDate: Date | null;
  // "HH:mm", when the pickup window has an end.
  pickupEndTime?: string | null;
  // The second pickup, when the cycle has one.
  pickup2Date?: Date | null;
  pickup2EndTime?: string | null;
  cycleStatus: string;
  cycleCreatedAt: Date;
  // "wallet" when left out.
  paymentMode?: string;
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
  handling?: string; // the order preparation fee charged, positive
  // Pay-per-order: order and balance payments, positive, and the refunds to
  // the card net of the failed ones, positive.
  paid?: string;
  refunded?: string;
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
  // When the last pickup window closes, null while no pickup day is set.
  pickupEndsAt: Date | null;
  status: string;
  paymentMode: "wallet" | "per_order";
  lines: CycleHistoryLine[];
  // False while the cycle is open with nothing on the ledger yet (closing
  // posts the charges): the lines are a pending order, not a movement. A
  // pay-per-order cycle is charged only once closed, whatever it was paid.
  charged: boolean;
  // Pay-per-order, positive; 0 for wallet cycles.
  paid: number;
  refunded: number;
  // Costs, positive: the lines at coalesce(actual_line_total, line_total),
  // the shipping and the order preparation fee charged.
  productsTotal: number;
  shipping: number;
  handling: number;
  // Signed like the ledger (+ = credit to the member): what products and
  // shipping do not explain (a cancellation refund, a manual correction),
  // and the member's net on the cycle, SUM(amount) WHERE cycle_id.
  corrections: number;
  net: number;
};

function toCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

function latest(a: Date | null, b: Date | null): Date | null {
  if (!a || !b) return a ?? b;
  return a.getTime() >= b.getTime() ? a : b;
}

// The end of a pickup window: its end time on the pickup day, or the end of
// that day when the window has no end time (both in the group's time zone).
function pickupEnd(start: Date | null, endTime: string | null): Date | null {
  if (!start) return null;
  const day = utcToZonedLocalInput(start).slice(0, 10);
  const end = endTime ? zonedLocalToUtc(`${day}T${endTime}`) : null;
  if (end) return latest(start, end);
  const [y, m, d] = day.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return zonedLocalToUtc(`${nextDay}T00:00`);
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
      const handlingCents = ledger?.handling ? toCents(ledger.handling) : 0;
      const paymentMode = meta.paymentMode === "per_order" ? "per_order" : "wallet";
      const paidCents = ledger?.paid ? toCents(ledger.paid) : 0;
      const refundedCents = ledger?.refunded ? toCents(ledger.refunded) : 0;
      const charged =
        paymentMode === "per_order"
          ? meta.cycleStatus !== "open"
          : ledger !== undefined || meta.cycleStatus !== "open";
      return {
        cycleId: meta.cycleId,
        title: meta.cycleTitle,
        pickupDate: meta.pickupDate,
        pickupEndsAt: latest(
          pickupEnd(meta.pickupDate, meta.pickupEndTime ?? null),
          pickupEnd(meta.pickup2Date ?? null, meta.pickup2EndTime ?? null),
        ),
        status: meta.cycleStatus,
        paymentMode,
        lines,
        charged,
        paid: paidCents / 100,
        refunded: refundedCents / 100,
        productsTotal: productsCents / 100,
        shipping: shippingCents / 100,
        handling: handlingCents / 100,
        corrections: charged
          ? (netCents + productsCents + shippingCents + handlingCents - paidCents + refundedCents) / 100
          : 0,
        net: netCents / 100,
      };
    });
}

// The badge of a cycle in the Orders tab. A closed cycle whose pickup an
// admin marked (Admin → Ciclo → Ritiri) reads "collected"; otherwise it reads
// "to pick up" until its last pickup window closes and "done" after it (most
// groups do not mark pickups); with no pickup day set it only says the order
// is closed.
export type HistoryBadge = "open" | "cancelled" | "toPickUp" | "pickedUp" | "done" | "closed";

export function historyBadge(
  entry: Pick<CycleHistoryEntry, "status" | "pickupEndsAt"> & { pickedUpAt?: Date | string | null },
  now: Date,
): HistoryBadge {
  if (entry.status === "open") return "open";
  if (entry.status === "cancelled") return "cancelled";
  if (entry.pickedUpAt) return "pickedUp";
  if (!entry.pickupEndsAt) return "closed";
  return now < entry.pickupEndsAt ? "toPickUp" : "done";
}

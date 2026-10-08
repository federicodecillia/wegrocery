import { movementKind, type LedgerMovement, type MovementKind } from "@/lib/movement-label";

// Admin → Ciclo → Conti: what the cycle moved on the members' balances, read
// from its live ledger rows (lib/db/ledger-live.ts, so a corrected movement
// counts once). Read only: every change goes through Ordini, Fornitore or
// "Modifica ciclo".

export type CycleLedgerRow = LedgerMovement & {
  entryId: string;
  memberName: string;
  entryDate: Date;
  note: string | null;
  /** Set on a replacement row: the edit of an earlier movement. */
  replaces: string | null;
};

export type CycleMoneyLine = { kind: MovementKind; count: number; cents: number };

export type CycleMoney = {
  /** One line per kind of movement, in the order a cycle produces them. */
  lines: CycleMoneyLine[];
  /** Sum of every live row, in cents: what the cycle took from (−) or gave to (+) the balances. */
  netCents: number;
  /** Corrections made after the close, newest first. */
  adjustments: CycleLedgerRow[];
};

const ORDER: MovementKind[] = [
  "order",
  "shipping",
  "handling",
  "order_payment",
  "balance_payment",
  "adjustment",
  "refund",
  "order_refund",
  "online_refund",
  "refund_failed",
];

const cents = (amount: string | number) => Math.round((typeof amount === "string" ? parseFloat(amount) : amount) * 100);

/** A correction after the close: a "correction" row, or the replacement of an edited movement. */
export function isAdjustment(row: Pick<CycleLedgerRow, "type" | "replaces">): boolean {
  return row.type === "correction" || row.replaces != null;
}

export function summarizeCycleMoney(rows: CycleLedgerRow[]): CycleMoney {
  const byKind = new Map<MovementKind, CycleMoneyLine>();
  let netCents = 0;
  for (const row of rows) {
    const kind = movementKind(row);
    const c = cents(row.amount);
    netCents += c;
    const line = byKind.get(kind) ?? { kind, count: 0, cents: 0 };
    line.count += 1;
    line.cents += c;
    byKind.set(kind, line);
  }
  const rank = (k: MovementKind) => {
    const i = ORDER.indexOf(k);
    return i === -1 ? ORDER.length : i;
  };
  return {
    lines: [...byKind.values()].sort((a, b) => rank(a.kind) - rank(b.kind)),
    netCents,
    adjustments: rows.filter(isAdjustment).sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime()),
  };
}

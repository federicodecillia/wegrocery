import { t } from "@/lib/i18n";

// The cycle workspace (Admin → Ciclo): one cycle at a time, chosen in the
// list, with the views that make sense for where it stands. Pure, so the
// rules are tested without a database.

export type CycleView = "panoramica" | "prodotti" | "ordini" | "fornitore" | "conti";

export const CYCLE_VIEW_LABELS: Record<CycleView, string> = {
  panoramica: t.admin.workspace.views.panoramica,
  prodotti: t.admin.workspace.views.prodotti,
  ordini: t.admin.workspace.views.ordini,
  fornitore: t.admin.workspace.views.fornitore,
  conti: t.admin.workspace.views.conti,
};

export function isCycleView(value: string | undefined | null): value is CycleView {
  return value != null && Object.hasOwn(CYCLE_VIEW_LABELS, value);
}

/**
 * The views of a cycle by status: products only while it is open (the close
 * freezes them), the supplier once there is something to send, the accounts
 * (settlement, cancelling) after the close.
 */
export function cycleViews(status: string): CycleView[] {
  if (status === "open") return ["panoramica", "prodotti", "ordini"];
  if (status === "cancelled") return ["panoramica", "ordini", "conti"];
  return ["panoramica", "ordini", "fornitore", "conti"];
}

/** The view asked for when the cycle has it, else its overview. */
export function resolveCycleView(status: string, view: string | undefined | null): CycleView {
  return isCycleView(view) && cycleViews(status).includes(view) ? view : "panoramica";
}

type IndexedCycle = { cycleId: string; status: string; orderCloseAt: Date | null; createdAt: Date };

/**
 * The cycle shown when the URL names none (or one that does not exist): the
 * open cycle closing first, else the newest.
 */
export function defaultCycleId(cycles: IndexedCycle[], asked?: string): string | null {
  if (asked && cycles.some((c) => c.cycleId === asked)) return asked;
  const open = cycles
    .filter((c) => c.status === "open")
    .sort((a, b) => (a.orderCloseAt?.getTime() ?? Infinity) - (b.orderCloseAt?.getTime() ?? Infinity));
  if (open.length > 0) return open[0].cycleId;
  const newest = [...cycles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return newest?.cycleId ?? null;
}

export type CycleFilter = "all" | "open" | "closed" | "cancelled";

/** The list's filter and search: title words, accents and case ignored. */
export function filterCycles<T extends { title: string; status: string }>(cycles: T[], filter: CycleFilter, query: string): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = norm(query).split(/\s+/).filter(Boolean);
  return cycles.filter(
    (c) => (filter === "all" || c.status === filter) && words.every((w) => norm(c.title).includes(w)),
  );
}

/** How long after its settlement a card cycle is still checked for money left to settle. */
export const SETTLEMENT_RECHECK_DAYS = 90;

/**
 * Whether a cycle's settlement is worth checking: a card-paid cycle that is
 * closed or cancelled (both get "Chiudi i conti"), not settled yet or settled
 * recently enough that a later correction may have reopened it.
 */
export function settlementCandidate(
  c: { status: string; paymentMode: string; settledAt: Date | null },
  now: Date,
): boolean {
  if (c.paymentMode !== "per_order" || c.status === "open") return false;
  if (c.settledAt == null) return true;
  return now.getTime() - c.settledAt.getTime() <= SETTLEMENT_RECHECK_DAYS * 86_400_000;
}

/**
 * A settlement status that asks the admin to act: never run, money left to
 * refund or write off after a correction, or a refund that failed. The list
 * puts these first so "Chiudi i conti" is not forgotten.
 */
export function settlementPending(status: string | null): boolean {
  return status === "to_settle" || status === "needs_update" || status === "refund_failed";
}

export type CycleGroup = "toSettle" | "open" | "others";

/** The list in three groups, each keeping its order: accounts to settle, open, the rest. */
export function groupCycles<T extends { status: string; toSettle: boolean }>(cycles: T[]): { group: CycleGroup; cycles: T[] }[] {
  const groups: { group: CycleGroup; cycles: T[] }[] = [
    { group: "toSettle", cycles: cycles.filter((c) => c.toSettle) },
    { group: "open", cycles: cycles.filter((c) => !c.toSettle && c.status === "open") },
    { group: "others", cycles: cycles.filter((c) => !c.toSettle && c.status !== "open") },
  ];
  return groups.filter((g) => g.cycles.length > 0);
}

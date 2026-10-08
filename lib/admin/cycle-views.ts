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

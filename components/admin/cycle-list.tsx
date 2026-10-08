"use client";

import Link from "next/link";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { adminHref } from "@/lib/admin/nav";
import { filterCycles, type CycleFilter, type CycleView } from "@/lib/admin/cycle-views";

export type CycleListItem = {
  cycleId: string;
  title: string;
  status: string;
  perOrder: boolean;
  /** ISO: the close for an open cycle, the pickup (or creation) otherwise. */
  date: string | null;
};

const PAGE = 20;

const STATUS: Record<string, string> = {
  open: t.admin.cycle.openBadge,
  closed: t.admin.cycle.closedBadge,
  cancelled: t.admin.cycle.cancelledBadge,
};

const DOT: Record<string, string> = {
  open: "bg-accent",
  closed: "bg-brand-gray-light",
  cancelled: "bg-brand-red",
};

// Every cycle, newest first, with a status filter, a search and pages of 20:
// the archive replaces "Ultimi cicli", which stopped at 15 (older cycles
// could no longer be corrected or cancelled). A link keeps the current view.
export function CycleList({
  cycles,
  selectedId,
  view,
  onNavigate,
}: {
  cycles: CycleListItem[];
  selectedId: string | null;
  view: CycleView | null;
  onNavigate?: () => void;
}) {
  const [filter, setFilter] = useState<CycleFilter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const w = t.admin.workspace;
  const list = filterCycles(cycles, filter, query);

  return (
    <div>
      <Link
        href={adminHref("ciclo", null, { new: "1" })}
        onClick={onNavigate}
        className="mb-3 flex min-h-10 items-center justify-center rounded-xl border border-dashed border-primary-mid bg-primary-soft text-[13px] font-bold text-primary-text"
      >
        {w.newCycle}
      </Link>
      <label className="sr-only" htmlFor="cycle-search">
        {w.search}
      </label>
      <input
        id="cycle-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        placeholder={w.search}
        className="min-h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-[13px] placeholder:text-muted"
      />
      <div role="group" aria-label={w.listTitle} className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(w.filters) as CycleFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setShown(PAGE);
            }}
            className={`min-h-8 rounded-full px-2.5 text-label font-semibold ${
              filter === f ? "bg-brand-near-black text-white" : "bg-black/[0.05] text-brand-gray"
            }`}
          >
            {w.filters[f]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-brand-gray">{w.noMatch}</p>
      ) : (
        <ul className="mt-2 divide-y divide-brand-border">
          {list.slice(0, shown).map((c) => {
            const current = c.cycleId === selectedId;
            return (
              <li key={c.cycleId}>
                <Link
                  href={adminHref("ciclo", view, { cycle: c.cycleId })}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 ${
                    current ? "bg-primary-soft" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOT[c.status] ?? DOT.closed}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${current ? "font-bold" : "font-medium"} text-brand-near-black`}>
                      {c.perOrder && <span aria-hidden>💳 </span>}
                      {c.title}
                    </span>
                    <span className="block text-label text-muted">
                      {STATUS[c.status] ?? c.status}
                      {c.date ? ` · ${formatDate(c.date, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 min-h-10 w-full rounded-xl border border-brand-border text-[13px] font-semibold text-brand-near-black"
        >
          {w.showMore} ({list.length - shown})
        </button>
      )}
    </div>
  );
}

/** On a phone: the current cycle as a button that opens the list in a sheet. */
export function CyclePicker({
  cycles,
  selectedId,
  view,
}: {
  cycles: CycleListItem[];
  selectedId: string | null;
  view: CycleView | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-brand-border bg-white px-3 text-left text-[13px] font-semibold text-brand-near-black lg:hidden"
      >
        <span>{t.admin.workspace.chooseCycle}</span>
        <span aria-hidden className="text-brand-gray">
          ▾
        </span>
      </button>
      <Sheet open={open} onRequestClose={() => setOpen(false)} title={t.admin.workspace.listTitle} size="sm">
        <CycleList cycles={cycles} selectedId={selectedId} view={view} onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";

type FilterCycle = { cycleId: string; title: string };
type FilterSupplier = { supplierId: string; name: string };
type FilterMember = { memberId: string; fullName: string };

type Option = { id: string; label: string };

// Comma-separated multi-value params. Empty value or empty list both mean
// "no filter". Whitespace around individual ids is tolerated.
function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function StatsFilters({
  cycles,
  suppliers,
  members,
}: {
  cycles: FilterCycle[];
  suppliers: FilterSupplier[];
  members: FilterMember[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const currentCycles = parseList(sp.get("cycle"));
  const currentSuppliers = parseList(sp.get("supplier"));
  const currentMembers = parseList(sp.get("member"));
  const hasAny =
    currentCycles.length > 0 || currentSuppliers.length > 0 || currentMembers.length > 0;

  function pushWith(next: {
    cycles?: string[];
    suppliers?: string[];
    members?: string[];
  }) {
    const params = new URLSearchParams({ tab: "statistiche" });
    const c = next.cycles ?? currentCycles;
    const s = next.suppliers ?? currentSuppliers;
    const m = next.members ?? currentMembers;
    if (c.length > 0) params.set("cycle", c.join(","));
    if (s.length > 0) params.set("supplier", s.join(","));
    if (m.length > 0) params.set("member", m.join(","));
    router.push(`/admin?${params}`);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MultiSelect
          label={t.admin.stats.filterCycles}
          allLabel={t.admin.stats.filterAllCycles}
          selected={currentCycles}
          options={cycles.map((c) => ({ id: c.cycleId, label: c.title }))}
          onChange={(ids) => pushWith({ cycles: ids })}
        />
        <MultiSelect
          label={t.admin.stats.filterSuppliers}
          allLabel={t.admin.stats.filterAllSuppliers}
          selected={currentSuppliers}
          options={suppliers.map((s) => ({ id: s.supplierId, label: s.name }))}
          onChange={(ids) => pushWith({ suppliers: ids })}
        />
        <MultiSelect
          label={t.admin.stats.filterMembers}
          allLabel={t.admin.stats.filterAllMembers}
          selected={currentMembers}
          options={members.map((m) => ({ id: m.memberId, label: m.fullName }))}
          onChange={(ids) => pushWith({ members: ids })}
        />
      </div>
      {hasAny && (
        <button
          onClick={() => pushWith({ cycles: [], suppliers: [], members: [] })}
          className="text-[11px] font-semibold text-brand-orange hover:underline"
        >
          {t.admin.stats.removeFilters}
        </button>
      )}
    </div>
  );
}

// Compact dropdown with checkboxes. Closes on outside click or Esc.
// Renders an inline summary ("Tutti…" / "X selezionati" / single-name) so
// the filter row stays consistent with the previous single-select look.
function MultiSelect({
  label,
  allLabel,
  selected,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  selected: string[];
  options: Option[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  const selectedSet = new Set(selected);
  const visibleOptions = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.label ?? `1 ${label.toLowerCase()}`
        : t.admin.stats.selectedCount(selected.length, label.toLowerCase());

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
          selected.length > 0
            ? "border-brand-orange/40 bg-brand-orange-light text-brand-near-black"
            : "border-brand-border bg-white text-brand-near-black"
        }`}
      >
        <span className="truncate">{summary}</span>
        <span className="shrink-0 text-brand-gray-light">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[280px] overflow-hidden rounded-xl border border-brand-border bg-white shadow-lg">
          <div className="border-b border-brand-border p-2">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.admin.stats.searchFilter(label.toLowerCase())}
              className="w-full rounded-lg border border-brand-border px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 text-[11px] font-semibold text-brand-orange hover:underline"
              >
                {t.admin.stats.deselectAll}
              </button>
            )}
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-brand-gray">{t.admin.stats.noFilterResults}</p>
            ) : (
              visibleOptions.map((o) => {
                const checked = selectedSet.has(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-brand-warm-white/60 ${
                      checked ? "bg-brand-orange-light/40" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className="h-3.5 w-3.5 accent-brand-orange"
                    />
                    <span className="truncate text-brand-near-black">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

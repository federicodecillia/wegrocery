"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatEur, getProductEmoji } from "@/lib/utils";
import type { CycleSummary } from "@/lib/db/queries";

// ── Ordini Filters ────────────────────────────────────────────────────────────

type FilterCycle = { cycleId: string; title: string };
type FilterMember = { memberId: string; fullName: string };

export function OrdiniFilters({
  allCycles,
  allMembers,
}: {
  allCycles: FilterCycle[];
  allMembers: FilterMember[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const currentCycle = sp.get("cycle") ?? "";
  const currentMember = sp.get("member") ?? "";

  const selectCls =
    "rounded-xl border border-pm-border bg-white px-3 py-2 text-[12px] font-semibold text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30 flex-1";

  function onMemberChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams({ tab: "ordini" });
    if (val) params.set("member", val);
    router.push(`/admin?${params}`);
  }

  function onCycleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams({ tab: "ordini" });
    if (val) params.set("cycle", val);
    router.push(`/admin?${params}`);
  }

  return (
    <div className="flex gap-2">
      <select className={selectCls} value={currentMember} onChange={onMemberChange}>
        <option value="">Tutti i soci</option>
        {allMembers.map((m) => (
          <option key={m.memberId} value={m.memberId}>
            {m.fullName}
          </option>
        ))}
      </select>
      {!currentMember && (
        <select className={selectCls} value={currentCycle} onChange={onCycleChange}>
          <option value="">Ciclo corrente</option>
          {allCycles.map((c) => (
            <option key={c.cycleId} value={c.cycleId}>
              {c.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Expandable member rows ────────────────────────────────────────────────────

export function OrdiniByMember({ byMember }: { byMember: CycleSummary["byMember"] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(memberId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) { next.delete(memberId); } else { next.add(memberId); }
      return next;
    });
  }

  return (
    <div className="divide-y divide-pm-border">
      {byMember.map((m) => (
        <div key={m.memberId}>
          <button
            onClick={() => toggle(m.memberId)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-[13px] font-medium text-pm-near-black">{m.fullName}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-pm-near-black">
                {formatEur(m.total)}
              </span>
              <span className="text-pm-gray-light">{expanded.has(m.memberId) ? "▲" : "▼"}</span>
            </div>
          </button>
          {expanded.has(m.memberId) && (
            <div className="bg-black/[0.02] px-4 pb-3 pt-1">
              {m.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-pm-gray">
                    <span className="text-[14px] leading-none">{getProductEmoji(line.productName)}</span>
                    {line.productName}
                    {line.variant ? ` · ${line.variant}` : ""}
                    <span className="ml-1 font-mono text-[11px] text-pm-gray-light">
                      ×{line.quantity}
                    </span>
                    {line.adjusted && (
                      <span className="ml-1 rounded-full bg-pm-orange/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-pm-orange">
                        rettificato
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[12px] text-pm-near-black">
                    {formatEur(line.lineTotal)}
                  </span>
                </div>
              ))}
              {m.shipping > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-pm-gray">
                    <span className="text-[14px] leading-none">🚚</span>
                    Spedizione
                  </span>
                  <span className="font-mono text-[12px] text-pm-near-black">
                    {formatEur(m.shipping)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function CsvExportButton({
  summary,
  cycleTitle,
}: {
  summary: CycleSummary;
  cycleTitle: string;
}) {
  function handleExport() {
    const rows: string[][] = [["Socio", "Prodotto", "Varietà", "Quantità", "Totale €"]];
    for (const m of summary.byMember) {
      for (const line of m.lines) {
        rows.push([
          m.fullName,
          line.productName,
          line.variant ?? "",
          String(line.quantity),
          line.lineTotal.toFixed(2),
        ]);
      }
      if (m.shipping > 0) {
        rows.push([m.fullName, "Spedizione", "", "1", m.shipping.toFixed(2)]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordini_${cycleTitle.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-xl border border-pm-border px-4 py-2 text-[12px] font-semibold text-pm-gray"
    >
      Esporta CSV
    </button>
  );
}

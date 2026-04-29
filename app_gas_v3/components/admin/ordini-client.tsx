"use client";

import { useState } from "react";
import { formatEur } from "@/lib/utils";
import type { CycleSummary } from "@/lib/db/queries";

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
                  <span className="text-[12px] text-pm-gray">
                    {line.productName}
                    {line.variant ? ` · ${line.variant}` : ""}
                    <span className="ml-2 font-mono text-[11px] text-pm-gray-light">
                      ×{line.quantity}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-pm-near-black">
                    {formatEur(line.lineTotal)}
                  </span>
                </div>
              ))}
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

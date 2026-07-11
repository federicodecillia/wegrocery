"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminBuildSupplierDistinta } from "@/lib/actions/admin";
import { toast } from "@/components/ui/toast";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { CycleSummary } from "@/lib/db/queries";

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

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
    "rounded-xl border border-brand-border bg-white px-3 py-2 text-[12px] font-semibold text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-orange/30 min-w-0 max-w-full flex-1";

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
        <option value="">{t.admin.orders.allMembers}</option>
        {allMembers.map((m) => (
          <option key={m.memberId} value={m.memberId}>
            {m.fullName}
          </option>
        ))}
      </select>
      {!currentMember && (
        <select className={selectCls} value={currentCycle} onChange={onCycleChange}>
          <option value="">{t.admin.orders.currentCycle}</option>
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
    <div className="divide-y divide-brand-border">
      {byMember.map((m) => (
        <div key={m.memberId}>
          <button
            onClick={() => toggle(m.memberId)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-[13px] font-medium text-brand-near-black">{m.fullName}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-brand-near-black">
                {formatEur(m.total)}
              </span>
              <span className="text-brand-gray-light">{expanded.has(m.memberId) ? "▲" : "▼"}</span>
            </div>
          </button>
          {expanded.has(m.memberId) && (
            <div className="bg-black/[0.02] px-4 pb-3 pt-1">
              {m.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-brand-gray">
                    <span className="text-[14px] leading-none">{getProductEmoji(line.productName)}</span>
                    {line.productName}
                    {line.variant ? ` · ${line.variant}` : ""}
                    <span className="ml-1 font-mono text-[11px] text-brand-gray-light">
                      ×{line.quantity}
                    </span>
                    {line.adjusted && (
                      <span className="ml-1 rounded-full bg-brand-orange/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand-orange">
                        {t.admin.orders.adjustedBadge}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[12px] text-brand-near-black">
                    {formatEur(line.lineTotal)}
                  </span>
                </div>
              ))}
              {m.shipping > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-brand-gray">
                    <span className="text-[14px] leading-none">🚚</span>
                    {t.admin.orders.shippingLine}
                  </span>
                  <span className="font-mono text-[12px] text-brand-near-black">
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

// Downloads the same canonical xlsx workbook that the Supplier actions
// dialog ships (Distinta + Riepilogo + Totali per prodotto). One file,
// one source of truth — no more divergent CSVs.
export function CsvExportButton({
  cycleId,
}: {
  cycleId: string;
  // Kept on the call-site (tab-ordini) for parity with the previous API,
  // but the filename now comes from the server so we ignore it here.
  cycleTitle?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const r = await adminBuildSupplierDistinta(cycleId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const blob = decodeBase64ToBlob(
        r.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      onClick={handleExport}
      disabled={isPending}
      className="rounded-xl border border-brand-border px-4 py-2 text-[12px] font-semibold text-brand-gray disabled:opacity-60"
    >
      {isPending ? t.admin.orders.generatingExcel : t.admin.orders.downloadExcel}
    </button>
  );
}

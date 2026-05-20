"use client";

import { useRouter, useSearchParams } from "next/navigation";

type FilterCycle = { cycleId: string; title: string };
type FilterSupplier = { supplierId: string; name: string };
type FilterMember = { memberId: string; fullName: string };

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
  const currentCycle = sp.get("cycle") ?? "";
  const currentSupplier = sp.get("supplier") ?? "";
  const currentMember = sp.get("member") ?? "";
  const hasAny = Boolean(currentCycle || currentSupplier || currentMember);

  function pushWith(next: { cycle?: string; supplier?: string; member?: string }) {
    const params = new URLSearchParams({ tab: "statistiche" });
    const cycle = "cycle" in next ? next.cycle : currentCycle;
    const supplier = "supplier" in next ? next.supplier : currentSupplier;
    const member = "member" in next ? next.member : currentMember;
    if (cycle) params.set("cycle", cycle);
    if (supplier) params.set("supplier", supplier);
    if (member) params.set("member", member);
    router.push(`/admin?${params}`);
  }

  const selectCls =
    "w-full rounded-xl border border-pm-border bg-white px-3 py-2 text-[12px] font-semibold text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          className={selectCls}
          value={currentCycle}
          onChange={(e) => pushWith({ cycle: e.target.value })}
        >
          <option value="">Tutti i cicli</option>
          {cycles.map((c) => (
            <option key={c.cycleId} value={c.cycleId}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={currentSupplier}
          onChange={(e) => pushWith({ supplier: e.target.value })}
        >
          <option value="">Tutti i fornitori</option>
          {suppliers.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={currentMember}
          onChange={(e) => pushWith({ member: e.target.value })}
        >
          <option value="">Tutti i soci</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </select>
      </div>
      {hasAny && (
        <button
          onClick={() => pushWith({ cycle: "", supplier: "", member: "" })}
          className="text-[11px] font-semibold text-pm-orange hover:underline"
        >
          ✕ Rimuovi filtri
        </button>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";

const TABS = [
  { id: "ciclo", label: t.admin.cycle.tabLabel },
  { id: "prodotti", label: t.admin.products.tabLabel },
  { id: "ordini", label: t.admin.orders.tabLabel },
  { id: "cassa", label: t.admin.treasury.tabLabel },
  { id: "soci", label: t.admin.members.tabLabel },
  { id: "fornitori", label: t.admin.suppliers.tabLabel },
  { id: "statistiche", label: t.admin.stats.tabLabel },
] as const;

export function AdminNav() {
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") ?? "ciclo";

  return (
    <div className="mb-4 flex gap-1 rounded-full bg-black/[0.05] p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin?tab=${tab.id}`}
          className={`flex-1 rounded-full py-[7px] text-center text-[12px] font-semibold transition-colors ${
            active === tab.id
              ? "bg-white text-brand-near-black shadow-sm"
              : "text-brand-gray"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

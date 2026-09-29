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

function tabClass(active: boolean): string {
  return `rounded-full py-[7px] text-center text-[12px] font-semibold transition-colors ${
    active ? "bg-white text-brand-near-black shadow-sm" : "text-brand-gray"
  }`;
}

export function AdminNav() {
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") ?? "ciclo";

  return (
    // Scrolls sideways when the labels do not fit (English on a phone); in
    // Italian all eight fit at 375 px.
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-black/[0.05] p-1 [scrollbar-width:none]">
      {TABS.map((tab) => (
        <Link key={tab.id} href={`/admin?tab=${tab.id}`} className={`flex-1 ${tabClass(active === tab.id)}`}>
          {tab.label}
        </Link>
      ))}
      {/* Settings as an icon: the row has no room for an eighth label. */}
      <Link
        href="/admin?tab=impostazioni"
        aria-label={t.admin.settings.tabLabel}
        title={t.admin.settings.tabLabel}
        className={`flex flex-none items-center justify-center px-[10px] ${tabClass(active === "impostazioni")}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </div>
  );
}

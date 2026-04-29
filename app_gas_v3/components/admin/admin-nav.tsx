"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { id: "ciclo", label: "Ciclo" },
  { id: "prodotti", label: "Prodotti" },
  { id: "ordini", label: "Ordini" },
  { id: "cassa", label: "Cassa" },
  { id: "soci", label: "Soci" },
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
              ? "bg-white text-pm-near-black shadow-sm"
              : "text-pm-gray"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";

type Side = "member" | "product";

/** "Per socio | Per prodotto": a switch on a phone or tablet, both side by side from lg. */
export function OrdersSplit({ byMember, byProduct }: { byMember: ReactNode; byProduct: ReactNode }) {
  const [side, setSide] = useState<Side>("member");
  const o = t.admin.orders;
  const options: { id: Side; label: string }[] = [
    { id: "member", label: o.perMemberTitle },
    { id: "product", label: o.perProductTitle },
  ];
  return (
    <div>
      <div role="group" aria-label={o.splitAria} className="mb-3 flex gap-1 rounded-full bg-black/[0.05] p-1 lg:hidden">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={side === opt.id}
            onClick={() => setSide(opt.id)}
            className={`min-h-10 flex-1 rounded-full text-[13px] font-semibold ${
              side === opt.id ? "bg-white text-brand-near-black shadow-sm" : "text-brand-gray"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className={side === "member" ? "" : "hidden lg:block"}>{byMember}</div>
        <div className={side === "product" ? "" : "hidden lg:block"}>{byProduct}</div>
      </div>
    </div>
  );
}

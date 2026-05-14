import Link from "next/link";
import { getAdminInsights } from "@/lib/db/queries";
import { getProductEmoji } from "@/lib/utils";

// Three at-a-glance mini-cards shown above the open-cycles list. The
// component is async (server) so it doesn't ship JS for what is purely
// read-only data. Cards become Links to the relevant admin tab so the
// admin can drill in with one click.
export async function AdminInsights() {
  const insights = await getAdminInsights();

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      <InsightCard
        tone={insights.closingSoonCount > 0 ? "warning" : "neutral"}
        href="/admin?tab=ciclo"
        icon="⏰"
        label="In scadenza"
        value={insights.closingSoonCount.toString()}
        hint="≤24h"
      />
      <InsightCard
        tone={insights.negativeBalanceMembers > 0 ? "danger" : "neutral"}
        href="/admin?tab=cassa"
        icon="💸"
        label={<>Saldo {"<"} 0</>}
        value={insights.negativeBalanceMembers.toString()}
        hint="soci"
      />
      <InsightCard
        tone="info"
        href="/admin?tab=statistiche"
        icon={insights.topProductLast30Days?.emoji || getProductEmoji(insights.topProductLast30Days?.name ?? "")}
        label="Top 30gg"
        value={insights.topProductLast30Days?.name ?? "—"}
        hint={
          insights.topProductLast30Days
            ? `${insights.topProductLast30Days.totalQty} ordinati`
            : undefined
        }
        truncate
      />
    </div>
  );
}

import type { ReactNode } from "react";

function InsightCard({
  tone,
  href,
  icon,
  label,
  value,
  hint,
  truncate,
}: {
  tone: "neutral" | "warning" | "danger" | "info";
  href: string;
  icon: string;
  label: ReactNode;
  value: string;
  hint?: string;
  truncate?: boolean;
}) {
  const toneClasses = {
    neutral: "border-pm-border bg-white",
    warning: "border-pm-orange-mid bg-pm-orange-light",
    danger: "border-pm-red/30 bg-pm-red-light",
    info: "border-pm-teal/20 bg-pm-teal-light",
  }[tone];

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-2.5 transition-transform active:scale-[0.98] ${toneClasses}`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-1">
        <span className="font-mono text-[8px] uppercase tracking-wide text-pm-gray">
          {label}
        </span>
        <span className="text-[13px] leading-none">{icon}</span>
      </div>
      <div
        className={`text-[15px] font-black tracking-[-0.02em] text-pm-near-black ${truncate ? "truncate" : ""}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate font-mono text-[8px] text-pm-gray-light">
          {hint}
        </div>
      )}
    </Link>
  );
}

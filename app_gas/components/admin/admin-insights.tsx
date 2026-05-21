import Link from "next/link";
import { getAdminInsights } from "@/lib/db/queries";

// Three at-a-glance mini-cards shown above the open-cycles list. They form
// a left-to-right timeline of the cycle lifecycle: open → closing soon →
// recently closed. Each card links to the relevant section so the admin
// can drill in with one click.
export async function AdminInsights() {
  const insights = await getAdminInsights();

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      <InsightCard
        tone={insights.openCyclesCount > 0 ? "info" : "neutral"}
        href="/admin?tab=ciclo"
        icon="🟢"
        label="Aperti"
        value={insights.openCyclesCount.toString()}
        hint="cicli attivi"
      />
      <InsightCard
        tone={insights.closingSoonCount > 0 ? "warning" : "neutral"}
        href="/admin?tab=ciclo"
        icon="⏰"
        label="In scadenza"
        value={insights.closingSoonCount.toString()}
        hint="≤7gg"
      />
      <InsightCard
        tone={insights.recentlyClosedCount > 0 ? "info" : "neutral"}
        href="/admin?tab=ciclo"
        icon="✅"
        label="Chiusi"
        value={insights.recentlyClosedCount.toString()}
        hint="ultimi 7gg"
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

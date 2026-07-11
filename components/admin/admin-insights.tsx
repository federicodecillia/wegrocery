import Link from "next/link";
import { getAdminInsights } from "@/lib/db/queries";
import { t } from "@/lib/i18n";

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
        label={t.admin.stats.insightOpen}
        value={insights.openCyclesCount.toString()}
        hint={t.admin.stats.insightOpenHint}
      />
      <InsightCard
        tone={insights.closingSoonCount > 0 ? "warning" : "neutral"}
        href="/admin?tab=ciclo"
        icon="⏰"
        label={t.admin.stats.insightExpiring}
        value={insights.closingSoonCount.toString()}
        hint={t.admin.stats.insightExpiringHint}
      />
      <InsightCard
        tone={insights.recentlyClosedCount > 0 ? "info" : "neutral"}
        href="/admin?tab=ciclo"
        icon="✅"
        label={t.admin.stats.insightClosed}
        value={insights.recentlyClosedCount.toString()}
        hint={t.admin.stats.insightClosedHint}
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
    neutral: "border-brand-border bg-white",
    warning: "border-brand-orange-mid bg-brand-orange-light",
    danger: "border-brand-red/30 bg-brand-red-light",
    info: "border-brand-teal/20 bg-brand-teal-light",
  }[tone];

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-2.5 transition-transform active:scale-[0.98] ${toneClasses}`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray">
          {label}
        </span>
        <span className="text-[13px] leading-none">{icon}</span>
      </div>
      <div
        className={`text-[15px] font-black tracking-[-0.02em] text-brand-near-black ${truncate ? "truncate" : ""}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate font-mono text-[10px] text-brand-gray-light">
          {hint}
        </div>
      )}
    </Link>
  );
}

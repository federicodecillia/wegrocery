import { t } from "@/lib/i18n";
import { formatTime, formatDate } from "@/lib/i18n/format";
import type { NextPickup } from "@/lib/db/queries";

// Visible only when the member has at least one ordered cycle whose pickup
// (or pickup2) is still in the future. Promotes the most-asked piece of
// info ("quando ritiro?") to a prominent home card so members don't have
// to dig into the cycle countdown to find it.
export function NextPickupCard({ pickup }: { pickup: NextPickup }) {
  const date = pickup.pickupDate;
  const now = new Date();
  const msUntil = date.getTime() - now.getTime();
  const daysUntil = Math.floor(msUntil / (1000 * 60 * 60 * 24));

  const dayLabel = formatDayLabel(date, daysUntil);
  const startTime = formatTime(date);
  const timeRange = pickup.pickupEndTime ? `${startTime}–${pickup.pickupEndTime}` : startTime;

  return (
    <div className="mb-[14px] rounded-[16px] border border-brand-teal/20 bg-brand-teal-light p-[14px_16px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-[3px] flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-brand-teal">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {pickup.isSecondPickup ? t.cycle.secondPickup : t.cycle.nextPickup}
          </div>
          <div className="text-[15px] font-bold tracking-[-0.01em] text-brand-near-black">
            {dayLabel}
          </div>
          <div className="mt-[2px] font-mono text-[12px] font-semibold text-brand-near-black/80">
            {timeRange}
          </div>
          {(pickup.cycleTitle || pickup.supplierName) && (
            <div className="mt-[2px] truncate text-[11px] text-brand-gray">
              {[pickup.cycleTitle, pickup.supplierName].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {daysUntil >= 0 && daysUntil <= 14 && (
          <div className="shrink-0 text-right">
            <div className="text-[28px] font-black leading-none tracking-[-0.04em] text-brand-teal">
              {daysUntil}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.07em] text-brand-teal/80">
              {daysUntil === 1 ? t.cycle.days_singular : t.cycle.days_plural}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDayLabel(date: Date, daysUntil: number): string {
  if (daysUntil === 0) return t.cycle.today;
  if (daysUntil === 1) return t.cycle.tomorrow;
  return formatDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

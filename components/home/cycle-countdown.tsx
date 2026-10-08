"use client";

import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/i18n/format";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";
import Link from "next/link";

type Props = {
  cycleId: string;
  title: string;
  orderCloseAt: string;
  orderOpenAt: string;
  pickupDate: string | null;
  pickupEndTime: string | null;
  pickup2Date: string | null;
  pickup2EndTime: string | null;
};

function computeCountdown(closeAt: string, openAt: string, now: Date) {
  const close = new Date(closeAt);
  const open = new Date(openAt);
  const remaining = Math.max(0, close.getTime() - now.getTime());
  const totalMs = close.getTime() - open.getTime();
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round(((now.getTime() - open.getTime()) / totalMs) * 100))) : 100;
  const days = Math.floor(remaining / 86_400_000);
  const hrs = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const hoursLeft = Math.floor(remaining / 3_600_000);
  return { days, hrs, mins, hoursLeft, pct };
}

function formatPickupSlot(date: string, endTime: string | null): string {
  const d = new Date(date);
  const dateStr = formatDate(d, { weekday: "short", day: "numeric", month: "short" });
  // Midnight in the app zone means "date only"; getHours() would read the
  // server's UTC clock during SSR and the browser's clock after hydration.
  const hasStartTime = !utcToZonedLocalInput(d).endsWith("T00:00");
  if (!hasStartTime) return dateStr;
  const startStr = formatTime(d);
  return endTime ? `${dateStr} · ${startStr}–${endTime}` : `${dateStr} · ${startStr}`;
}

export function CycleCountdown({ cycleId, title, orderCloseAt, orderOpenAt, pickupDate, pickupEndTime, pickup2Date, pickup2EndTime }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { days, hrs, mins, hoursLeft, pct } = computeCountdown(
    orderCloseAt,
    orderOpenAt,
    now ?? new Date(orderCloseAt),
  );

  const danger = hoursLeft <= 12;

  return (
    <div className="mb-[14px] rounded-card border border-brand-border bg-white shadow-card p-[18px]">
      <div className="mb-[14px] flex items-start justify-between">
        <div>
          <div className="text-[16px] font-extrabold tracking-[-0.02em] text-brand-near-black leading-snug">
            {title}
          </div>
          <div className="mt-[3px] space-y-[2px]">
            <div className="font-mono text-label text-brand-gray">
              {t.cycle.closes(formatDateTime(orderCloseAt))}
            </div>
            {pickupDate && (
              <div className="font-mono text-label text-brand-gray">
                {pickup2Date ? t.cycle.pickup1(formatPickupSlot(pickupDate, pickupEndTime)) : `${t.cycle.pickup}: ${formatPickupSlot(pickupDate, pickupEndTime)}`}
              </div>
            )}
            {pickup2Date && (
              <div className="font-mono text-label text-brand-gray">
                {t.cycle.pickup2(formatPickupSlot(pickup2Date, pickup2EndTime))}
              </div>
            )}
          </div>
        </div>
        <Badge tone="accent" dot>
          {t.cycle.open}
        </Badge>
      </div>

      <div className="mb-[14px] flex gap-2">
        {[
          { num: days, unit: t.cycle.days },
          { num: hrs, unit: t.cycle.hours },
          { num: mins, unit: t.cycle.minutes },
        ].map(({ num, unit }) => (
          <div
            key={unit}
            className="min-w-[62px] rounded-[10px] bg-black/[0.06] px-[14px] py-[9px] text-center"
          >
            <div className="font-mono text-[22px] font-semibold leading-none text-brand-near-black">
              {num}
            </div>
            <div className="mt-[3px] font-mono text-label uppercase tracking-[0.08em] text-muted">
              {unit}
            </div>
          </div>
        ))}
      </div>

      <div className="h-[3px] overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${danger ? "bg-brand-red" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-[5px] font-mono text-label text-muted">
        {t.cycle.daysRemaining(hoursLeft)}
      </div>

      <div className="mt-3">
        <Link
          href={`/ordine?cycleId=${cycleId}`}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-[22px] py-[14px] text-sm font-bold text-on-primary transition-[opacity,transform] duration-150 active:scale-[0.98]"
        >
          {t.cycle.goToOrder}
        </Link>
      </div>
    </div>
  );
}

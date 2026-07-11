"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/i18n/format";
import Link from "next/link";

type Props = {
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
  const hasStartTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasStartTime) return dateStr;
  const startStr = formatTime(d);
  return endTime ? `${dateStr} · ${startStr}–${endTime}` : `${dateStr} · ${startStr}`;
}

export function CycleCountdown({ title, orderCloseAt, orderOpenAt, pickupDate, pickupEndTime, pickup2Date, pickup2EndTime }: Props) {
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
    <div className="mb-[14px] rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-[18px]">
      <div className="mb-[14px] flex items-start justify-between">
        <div>
          <div className="text-[16px] font-extrabold tracking-[-0.02em] text-brand-near-black leading-snug">
            {title}
          </div>
          <div className="mt-[3px] space-y-[2px]">
            <div className="font-mono text-[10px] text-brand-gray">
              {t.cycle.closes(formatDateTime(orderCloseAt))}
            </div>
            {pickupDate && (
              <div className="font-mono text-[10px] text-brand-gray">
                {pickup2Date ? t.cycle.pickup1(formatPickupSlot(pickupDate, pickupEndTime)) : `${t.cycle.pickup}: ${formatPickupSlot(pickupDate, pickupEndTime)}`}
              </div>
            )}
            {pickup2Date && (
              <div className="font-mono text-[10px] text-brand-gray">
                {t.cycle.pickup2(formatPickupSlot(pickup2Date, pickup2EndTime))}
              </div>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/20 bg-brand-teal-light px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand-teal">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-teal opacity-75" />
          {t.cycle.open}
        </span>
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
            <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-brand-gray-light">
              {unit}
            </div>
          </div>
        ))}
      </div>

      <div className="h-[3px] overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${danger ? "bg-brand-red" : "bg-brand-teal"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-[5px] font-mono text-[10px] text-brand-gray-light">
        {t.cycle.daysRemaining(hoursLeft)}
      </div>

      <div className="mt-3">
        <Link
          href="/ordine"
          className="inline-flex w-full items-center justify-center rounded-full bg-brand-orange px-[22px] py-[14px] text-sm font-bold text-white transition-[opacity,transform] duration-150 active:scale-[0.98]"
        >
          {t.cycle.goToOrder}
        </Link>
      </div>
    </div>
  );
}

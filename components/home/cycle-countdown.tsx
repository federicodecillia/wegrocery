"use client";

import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { closesIn, formatDeadline, formatPickups, isLastDay } from "@/lib/i18n/deadline";
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
  /** The member has a confirmed order on this cycle. */
  hasOrder: boolean;
};

function computeCountdown(closeAt: string, openAt: string, now: Date) {
  const close = new Date(closeAt);
  const open = new Date(openAt);
  const remaining = Math.max(0, close.getTime() - now.getTime());
  const totalMs = close.getTime() - open.getTime();
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round(((now.getTime() - open.getTime()) / totalMs) * 100))) : 100;
  const hrs = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  return { hrs, mins, pct };
}

// The open cycle on Home: what it is, until when, when to collect, and the
// way to the order right there. The countdown boxes appear only in the last
// day, when the minutes matter.
export function CycleCountdown({ cycleId, title, orderCloseAt, orderOpenAt, pickupDate, pickupEndTime, pickup2Date, pickup2EndTime, hasOrder }: Props) {
  // null until mounted: the server and the browser would disagree on "now".
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastDay = now !== null && isLastDay(orderCloseAt, now);
  const { hrs, mins, pct } = computeCountdown(orderCloseAt, orderOpenAt, now ?? new Date(orderCloseAt));
  const pickups = formatPickups(
    pickupDate ? { date: pickupDate, endTime: pickupEndTime } : null,
    pickup2Date ? { date: pickup2Date, endTime: pickup2EndTime } : null,
  );

  return (
    <div className="mb-[14px] rounded-card border border-brand-border bg-white p-[18px] shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-brand-near-black">{title}</h2>
        <Badge tone="accent" dot>
          {t.cycle.open}
        </Badge>
      </div>
      <p className={`mt-1 text-[14px] ${lastDay ? "font-semibold text-brand-red" : "text-brand-near-black"}`}>
        {now ? `${closesIn(orderCloseAt, now)} · ` : `${t.cycle.closesLabel} `}
        <span className="whitespace-nowrap">{formatDeadline(orderCloseAt)}</span>
      </p>
      {pickups.map((line, i) => (
        <p key={i} className="mt-0.5 text-[14px] text-brand-gray">
          {pickups.length > 1 ? (i === 0 ? t.cycle.pickup1(line) : t.cycle.pickup2(line)) : `${t.cycle.pickup}: ${line}`}
        </p>
      ))}

      {lastDay && (
        <div className="mt-[14px]">
          <div className="mb-[10px] flex gap-2" aria-hidden>
            {[
              { num: hrs, unit: t.cycle.hours },
              { num: mins, unit: t.cycle.minutes },
            ].map(({ num, unit }) => (
              <div key={unit} className="min-w-[62px] rounded-[10px] bg-black/[0.06] px-[14px] py-[9px] text-center">
                <div className="font-mono text-[22px] font-semibold leading-none text-brand-near-black">{num}</div>
                <div className="mt-[3px] font-mono text-label uppercase tracking-[0.08em] text-muted">{unit}</div>
              </div>
            ))}
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-black/[0.07]">
            <div className="h-full rounded-full bg-brand-red transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {!hasOrder && <p className="mt-3 text-[14px] text-brand-gray">{t.cycle.notOrderedYet}</p>}
      <Link
        href={`/ordine?cycleId=${cycleId}`}
        className={buttonClass({ variant: "brand", block: true }, "mt-4")}
      >
        {t.cycle.goToOrder}
      </Link>
    </div>
  );
}

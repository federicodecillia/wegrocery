"use client";

import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { closesIn, formatDeadline, formatPickups, isLastDay } from "@/lib/i18n/deadline";

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
  const hrs = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  return { hrs, mins, pct };
}

// The head of an open cycle's card on Home: what it is, until when, when to
// collect. The countdown boxes appear only in the last day, when the minutes
// matter. The card itself (order, notes, the way to the order) is the page's.
export function CycleCountdown({ title, orderCloseAt, orderOpenAt, pickupDate, pickupEndTime, pickup2Date, pickup2EndTime }: Props) {
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
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-extrabold leading-snug tracking-[-0.02em] text-foreground">{title}</h3>
        <Badge variant="accent" dot>
          {t.cycle.open}
        </Badge>
      </div>
      <p className={`mt-0.5 text-[14px] ${lastDay ? "font-semibold text-destructive" : "text-foreground"}`}>
        {now ? `${closesIn(orderCloseAt, now)} · ` : `${t.cycle.closesLabel} `}
        <span className="whitespace-nowrap">{formatDeadline(orderCloseAt)}</span>
      </p>
      {pickups.map((line, i) => (
        <p key={i} className="text-[13px] text-secondary-foreground">
          {pickups.length > 1 ? (i === 0 ? t.cycle.pickup1(line) : t.cycle.pickup2(line)) : t.cycle.pickupSingle(line)}
        </p>
      ))}

      {lastDay && (
        <div className="mt-3.5">
          <div className="mb-2.5 flex gap-2" aria-hidden>
            {[
              { num: hrs, unit: t.cycle.hours },
              { num: mins, unit: t.cycle.minutes },
            ].map(({ num, unit }) => (
              <div key={unit} className="min-w-[62px] rounded-lg bg-tint/[0.06] px-3.5 py-2.25 text-center">
                <div className="tabular-nums text-[22px] font-semibold leading-none text-foreground">{num}</div>
                <div className="mt-0.75 font-mono text-label uppercase tracking-[0.08em] text-muted-foreground">{unit}</div>
              </div>
            ))}
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-tint/[0.07]">
            <div className="h-full rounded-full bg-danger transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

    </div>
  );
}

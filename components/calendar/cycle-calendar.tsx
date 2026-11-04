"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, LockOpen, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  entriesIn,
  eventInScope,
  eventKindsByDay,
  monthGrid,
  monthOf,
  monthRange,
  shiftMonth,
  type CalendarEntry,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarScope,
} from "@/lib/calendar";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

// /calendario: a month grid with a dot per kind of event on each day, and
// under it (beside it from lg) the cycles of the month, or of the day tapped.
// The days come worked out by the server (lib/calendar.ts); `today` too, so
// the grid does not depend on the device's clock.

const KINDS: CalendarEventKind[] = ["opens", "closes", "pickup"];

// Noon UTC is the same calendar day in every zone a group lives in.
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

// Each kind has its own shape as well as its colour (Playbook 2.5): a round
// dot opens, a square closes, a diamond is a pickup.
const DOT: Record<CalendarEventKind, string> = {
  opens: "rounded-full bg-accent",
  closes: "bg-primary",
  pickup: "rotate-45 bg-inverse",
};

const ICON_COLOR: Record<CalendarEventKind, string> = {
  opens: "text-accent-text",
  closes: "text-primary-text",
  pickup: "text-foreground",
};

function KindIcon({ kind, className }: { kind: CalendarEventKind; className?: string }) {
  const Icon = kind === "opens" ? LockOpen : kind === "closes" ? Lock : Package;
  return <Icon aria-hidden className={cn("size-4 shrink-0", ICON_COLOR[kind], className)} strokeWidth={2.25} />;
}

// Monday first: 2024-01-01 was a Monday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => formatDate(noon(`2024-01-0${i + 1}`), { weekday: "short" }));

export function CycleCalendar({ entries, today }: { entries: CalendarEntry[]; today: string }) {
  const c = t.calendar;
  const range = useMemo(() => monthRange(entries, today), [entries, today]);
  const kindsByDay = useMemo(() => eventKindsByDay(entries), [entries]);
  const [month, setMonth] = useState(monthOf(today));
  const [day, setDay] = useState<string | null>(null);

  const scope: CalendarScope = { month, day };
  const shown = entriesIn(entries, scope);
  const weeks = monthGrid(month);
  const monthLabel = formatDate(noon(`${month}-15`), { month: "long", year: "numeric" });
  const dayLabel = (d: string) => formatDate(noon(d), { weekday: "long", day: "numeric", month: "long" });

  function goMonth(next: string) {
    setMonth(next);
    setDay(null);
  }

  if (entries.length === 0) {
    return <p className="rounded-card border border-border bg-card p-4.5 text-[14px] text-secondary-foreground shadow-card">{c.empty}</p>;
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <section aria-label={monthLabel} className="mb-5 rounded-card border border-border bg-card p-3 shadow-card lg:sticky lg:top-4 lg:mb-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goMonth(shiftMonth(month, -1))}
            disabled={month <= range.first}
            aria-label={c.prevMonth}
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:opacity-30"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <h2 aria-live="polite" className="truncate text-[17px] font-bold capitalize text-foreground">
              {monthLabel}
            </h2>
            {(month !== monthOf(today) || day) && (
              <button
                type="button"
                onClick={() => goMonth(monthOf(today))}
                className="min-h-(--control-h) rounded-full border border-border px-2.5 text-label font-semibold text-secondary-foreground"
              >
                {c.today}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => goMonth(shiftMonth(month, 1))}
            disabled={month >= range.last}
            aria-label={c.nextMonth}
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>

        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="pb-1 text-center text-label font-semibold text-muted-foreground">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].day}>
                {week.map(({ day: d, inMonth }) => {
                  const kinds = kindsByDay.get(d);
                  const count = kinds?.size ?? 0;
                  if (!inMonth) {
                    return <td key={d} aria-hidden className="p-0.5" />;
                  }
                  const selected = day === d;
                  const isToday = d === today;
                  return (
                    <td key={d} className="p-0.5 text-center">
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={c.dayEvents(dayLabel(d), count)}
                        onClick={() => setDay(selected ? null : d)}
                        className={cn(
                          "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl tabular-nums",
                          selected
                            ? "font-bold text-foreground ring-2 ring-inverse"
                            : isToday
                              ? "bg-primary-bg font-bold text-primary-text ring-1 ring-primary-mid"
                              : d < today
                                ? "text-secondary-foreground"
                                : "text-foreground",
                        )}
                      >
                        <span className="text-[14px] leading-none">{Number(d.slice(8))}</span>
                        <span aria-hidden className="flex h-1.5 gap-1">
                          {KINDS.filter((k) => kinds?.has(k)).map((k) => (
                            <span
                              key={k}
                              className={cn("size-1.5", DOT[k])}
                            />
                          ))}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <ul aria-label={c.legendLabel} className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {KINDS.map((k) => (
            <li key={k} className="flex items-center gap-1.5 text-label text-secondary-foreground">
              <span aria-hidden className={cn("size-2", DOT[k])} />
              {c.kinds[k]}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-label text-muted-foreground">{c.tapHint}</p>
      </section>

      <section aria-labelledby="calendar-list-heading">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id="calendar-list-heading" className="text-[15px] font-bold text-foreground first-letter:uppercase">
            {day ? c.dayHeading(dayLabel(day)) : c.monthHeading(formatDate(noon(`${month}-15`), { month: "long" }))}
          </h2>
          {day && (
            <button
              type="button"
              onClick={() => setDay(null)}
              className="min-h-(--control-h) rounded-full border border-border px-2.5 text-label font-semibold text-secondary-foreground"
            >
              {c.showMonth}
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-4.5 text-[14px] text-secondary-foreground">
            {day ? c.emptyDay : c.emptyMonth}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((entry) => (
              <li key={entry.cycleId}>
                <CycleCard entry={entry} scope={scope} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CycleCard({ entry, scope }: { entry: CalendarEntry; scope: CalendarScope }) {
  const c = t.calendar;
  const meta = [entry.supplierName, entry.productCount > 0 ? c.products(entry.productCount) : null].filter(Boolean).join(" · ");
  return (
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="px-4 pb-3 pt-3.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={entry.state === "open" ? "accent" : entry.state === "planned" ? "brand" : "default"}
            dot={entry.state === "open"}
          >
            {c.states[entry.state]}
          </Badge>
          {entry.tentative && <Badge>{c.tentative}</Badge>}
          {entry.pickedUp ? (
            <Badge variant="accent">{c.pickedUp}</Badge>
          ) : (
            entry.hasOrder && <Badge variant="brand">{c.ordered}</Badge>
          )}
        </div>
        <h3 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{entry.title}</h3>
        {meta && <p className="mt-0.5 text-label text-secondary-foreground">{meta}</p>}
        <ul className="mt-2.5 space-y-1.5">
          {entry.events.map((event) => (
            <EventRow key={`${event.kind}-${event.at}`} event={event} highlight={scope.day ? eventInScope(event, scope) : false} />
          ))}
        </ul>
        {entry.state === "planned" && <PlannedPreview entry={entry} />}
      </div>
      {entry.href && (
        <Link
          href={entry.href}
          className="flex min-h-11 items-center justify-between border-t border-border bg-tint/[0.03] px-4 text-[14px] font-semibold text-primary-text"
        >
          {entry.state === "open" ? c.goOrder : c.goHistory}
          <span aria-hidden>→</span>
        </Link>
      )}
    </article>
  );
}

function EventRow({ event, highlight }: { event: CalendarEvent; highlight: boolean }) {
  const c = t.calendar;
  const label = event.kind === "pickup" && event.second ? c.secondPickup : c.kinds[event.kind];
  const when = formatDateTime(event.at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <li className={cn("-mx-1.5 flex items-start gap-2 rounded-lg px-1.5 py-0.5 text-[14px]", highlight && "bg-primary-bg")}>
      <KindIcon kind={event.kind} className="mt-0.5" />
      <span className="min-w-0">
        <span className="font-semibold text-foreground">{label}</span>{" "}
        <span className="tabular-nums text-secondary-foreground">
          {when}
          {event.endTime ? `–${event.endTime}` : ""}
        </span>
      </span>
    </li>
  );
}

// A planned cycle: members cannot order yet, but see what is coming. The list
// folds away so a long one does not push the next cycles down.
function PlannedPreview({ entry }: { entry: CalendarEntry }) {
  const c = t.calendar;
  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <p className="text-[13px] text-secondary-foreground">{c.plannedHint}</p>
      {entry.preview.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">{c.previewEmpty}</p>
      ) : (
        <details className="group mt-1.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-semibold text-primary-text [&::-webkit-details-marker]:hidden">
            {c.previewToggle(entry.preview.length)}
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mb-2 text-label text-muted-foreground">{c.previewNote}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {entry.preview.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-[14px]">
                <span className="flex min-w-0 items-start gap-2">
                  {p.emoji && (
                    <span aria-hidden className="w-4.5 shrink-0 text-[16px] leading-tight">
                      {p.emoji}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-foreground">{p.name}</span>
                    {p.detail && <span className="block text-label text-secondary-foreground">{p.detail}</span>}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-secondary-foreground">{formatMoney(p.price)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

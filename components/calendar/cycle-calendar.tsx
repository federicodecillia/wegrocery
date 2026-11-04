"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Package, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateTile, type DateTileTone } from "@/components/home/date-tile";
import { monthGrid, monthOf, monthRange, shiftMonth, type CalendarEntry } from "@/lib/calendar";
import {
  cyclesInMonth,
  cyclesOnDay,
  dayRole,
  defaultCycleId,
  spanOf,
  weekSegment,
  type CycleSpan,
} from "@/lib/calendar-view";
import { daysFrom, relativeDay } from "@/lib/home";
import { t } from "@/lib/i18n";
import { deadlineParts, formatLongDay, formatPickupLong } from "@/lib/i18n/deadline";
import { formatDate, formatMoney, formatTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

// /calendario. One clear model: the chips choose, the grid shows, the card
// explains. One cycle at a time by default (the one Home would put first):
// its days to order as a band, its last day as a solid tile, its pickup with
// a ring and a package. "Tutti" draws no ranges (with many long cycles they
// only add noise): each day shows the icons of what happens on it, with a
// count. Tapping a day selects its cycle, or lists the cycles of that day
// when there are several. The chips are one scrolling row on a phone, so the
// grid stays near the top. Days come from the server
// (lib/calendar.ts), so nothing depends on the device's clock.

/** How the chosen cycle is painted: the group's colour, grey once it is over. */
type Paint = { band: string; solid: string; ring: string; border: string };
const CURRENT: Paint = { band: "bg-primary-bg", solid: "bg-primary text-primary-foreground", ring: "ring-primary", border: "border-primary" };
const PAST: Paint = { band: "bg-tint/[0.06]", solid: "bg-tint/[0.14] text-foreground", ring: "ring-neutral", border: "border-neutral" };
/** Icons drawn in a day of "Tutti"; a busier day adds "+n". */
const DAY_ICONS = 2;

const noon = (day: string) => new Date(`${day}T12:00:00Z`);
const longDay = (day: string) => formatDate(noon(day), { weekday: "long", day: "numeric", month: "long" });
const monthName = (month: string) => formatDate(noon(`${month}-15`), { month: "long", year: "numeric" });
// Monday first: 2024-01-01 was a Monday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => formatDate(noon(`2024-01-0${i + 1}`), { weekday: "short" }));

/** "2–8 nov", the days to order (or the whole span when the cycle has no window). */
function rangeLabel(span: CycleSpan): string {
  const from = span.open ?? span.first;
  const to = span.close ?? span.last;
  const sameMonth = monthOf(from) === monthOf(to);
  const left = formatDate(noon(from), sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${left}–${formatDate(noon(to), { day: "numeric", month: "short" })}`;
}

/** Where the cycle stands for the member, in Home's words. */
function statusWord(entry: CalendarEntry): string {
  const s = t.calendar.status;
  if (entry.state === "planned") return s.planned;
  if (entry.state === "open") return entry.hasOrder ? s.ordered : s.toOrder;
  if (entry.pickedUp) return s.pickedUp;
  if (entry.state === "closed") return entry.hasOrder ? s.toCollect : s.closed;
  return s.past;
}

/** "ordini aperti, ultimo giorno per ordinare": what a day is for a cycle, for screen readers and the day list. */
function roleWords(span: CycleSpan, day: string): string {
  const c = t.calendar;
  const role = dayRole(span, day);
  const words: string[] = [];
  if (role.opens) words.push(c.kinds.opens);
  if (role.closes) words.push(c.kinds.closes);
  else if (role.window && !role.opens) words.push(c.windowWord);
  if (role.pickup) words.push(c.kinds.pickup);
  return words.join(", ");
}

export function CycleCalendar({ entries, today }: { entries: CalendarEntry[]; today: string }) {
  const c = t.calendar;
  const range = useMemo(() => monthRange(entries, today), [entries, today]);
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<string>(() => defaultCycleId(entries, monthOf(today)) ?? "all");
  const [dayList, setDayList] = useState<string | null>(null);

  const inMonth = useMemo(() => cyclesInMonth(entries, month), [entries, month]);
  const spans = useMemo(() => new Map(inMonth.map((e) => [e.cycleId, spanOf(e)])), [inMonth]);
  const chosen = selected === "all" ? null : (inMonth.find((e) => e.cycleId === selected) ?? null);
  const paint = (e: CalendarEntry) => (e.state === "past" ? PAST : CURRENT);

  // A month keeps the cycle chosen when it touches it, else opens on its own default.
  function goMonth(next: string) {
    setMonth(next);
    setDayList(null);
    const stays = selected !== "all" && cyclesInMonth(entries, next).some((e) => e.cycleId === selected);
    if (!stays && selected !== "all") setSelected(defaultCycleId(entries, next) ?? "all");
  }

  function choose(id: string) {
    setSelected(id);
    setDayList(null);
  }

  function tapDay(day: string) {
    const here = cyclesOnDay(inMonth, day);
    if (here.length === 1) choose(here[0].cycleId);
    else if (here.length > 1) setDayList(day);
  }

  if (entries.length === 0) {
    return <p className="rounded-card border border-border bg-card p-4.5 text-[15px] text-secondary-foreground shadow-card">{c.empty}</p>;
  }

  // The next month after this one with a cycle, for an empty month.
  let nextBusy: string | null = null;
  if (inMonth.length === 0) {
    for (let m = shiftMonth(month, 1); m <= range.last; m = shiftMonth(m, 1)) {
      if (cyclesInMonth(entries, m).length > 0) {
        nextBusy = m;
        break;
      }
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      <section aria-label={monthName(month)} className="mb-5 lg:mb-0">
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
            <h2 className="truncate text-[18px] font-extrabold capitalize text-foreground">{monthName(month)}</h2>
            {month !== monthOf(today) && (
              <button
                type="button"
                onClick={() => goMonth(monthOf(today))}
                className="min-h-(--control-h) rounded-full border border-border px-3 text-[14px] font-semibold text-secondary-foreground"
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
        <p aria-live="polite" className="sr-only">
          {c.monthSummary(monthName(month), inMonth.length)}
        </p>

        {inMonth.length > 0 && (
          // min-w-0: a fieldset is as wide as its content by default, and the chip row would widen the page.
          <fieldset className="mb-3 min-w-0">
            <legend className="sr-only">{c.chooseLabel}</legend>
            {/* One row that scrolls sideways on a phone (the grid stays near the top); wrapped from lg. */}
            <div className="-mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              {inMonth.length > 1 && (
                <Chip name="calendar-cycle" checked={selected === "all"} onChange={() => choose("all")}>
                  {c.all}
                </Chip>
              )}
              {inMonth.map((e) => (
                <Chip key={e.cycleId} name="calendar-cycle" checked={chosen?.cycleId === e.cycleId} onChange={() => choose(e.cycleId)}>
                  {e.title}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        <div className="rounded-card border border-border bg-card p-2 shadow-card sm:p-3">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-[13px] font-semibold text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          {monthGrid(month).map((cells) => {
            // Days of the months around are blank: their marks belong to those months.
            const week = cells.map((cell) => (cell.inMonth ? cell.day : ""));
            return (
              <div key={cells[0].day} className="relative grid grid-cols-7">
                {/* Under the numbers: the chosen cycle's band (nothing in "Tutti"). */}
                <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-7">
                  {chosen && <Band week={week} span={spans.get(chosen.cycleId)!} paint={paint(chosen)} dashed={chosen.state === "planned"} />}
                </div>
                {cells.map(({ day, inMonth: isInMonth }) =>
                  isInMonth ? (
                    <DayCell
                      key={day}
                      day={day}
                      today={today}
                      chosen={chosen}
                      chosenSpan={chosen ? spans.get(chosen.cycleId)! : null}
                      chosenPaint={chosen ? paint(chosen) : null}
                      cycles={cyclesOnDay(inMonth, day)}
                      spans={spans}
                      onTap={tapDay}
                    />
                  ) : (
                    <div key={day} aria-hidden className="h-14" />
                  ),
                )}
              </div>
            );
          })}
          <Legend chosen={chosen} paint={chosen ? paint(chosen) : CURRENT} />
        </div>
      </section>

      <section aria-live="polite" className="min-w-0">
        {inMonth.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-4.5 shadow-card">
            <p className="text-[15px] text-secondary-foreground first-letter:uppercase">{c.emptyMonth(formatDate(noon(`${month}-15`), { month: "long" }))}</p>
            {nextBusy && (
              <button
                type="button"
                onClick={() => goMonth(nextBusy!)}
                className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-[15px] font-semibold text-primary-text"
              >
                {c.goToMonth(formatDate(noon(`${nextBusy}-15`), { month: "long" }))} <span aria-hidden className="ml-1">→</span>
              </button>
            )}
          </div>
        ) : dayList ? (
          <DayList day={dayList} cycles={cyclesOnDay(inMonth, dayList)} spans={spans} onChoose={choose} />
        ) : chosen ? (
          <CycleDetail entry={chosen} span={spans.get(chosen.cycleId)!} today={today} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
            {inMonth.map((e) => (
              <li key={e.cycleId}>
                <CycleRowButton entry={e} span={spans.get(e.cycleId)!} today={today} onChoose={choose} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chip({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        // relative: the sr-only radio is absolute and would escape the scrolling row, widening the page.
        "relative inline-flex min-h-11 max-w-[15rem] shrink-0 cursor-pointer snap-start items-center rounded-full px-4 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        checked ? "bg-inverse font-bold text-inverse-foreground" : "border border-border bg-card font-semibold text-foreground",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="truncate">{children}</span>
    </label>
  );
}

/** The chosen cycle's days to order, as one band per week row, rounded only where it really starts or ends. */
function Band({ week, span, paint, dashed }: { week: string[]; span: CycleSpan; paint: Paint; dashed: boolean }) {
  if (!span.open || !span.close) return null;
  const seg = weekSegment(week, span.open, span.close);
  if (!seg) return null;
  return (
    <div
      className={cn(
        "row-start-1 mt-1 h-9",
        dashed ? cn("border-y-2 border-dashed", paint.border, seg.startsHere && "border-l-2", seg.endsHere && "border-r-2") : paint.band,
        seg.startsHere && "rounded-l-full",
        seg.endsHere && "rounded-r-full",
      )}
      style={{ gridColumn: `${seg.start + 1} / span ${seg.length}` }}
    />
  );
}

function DayCell({
  day,
  today,
  chosen,
  chosenSpan,
  chosenPaint,
  cycles,
  spans,
  onTap,
}: {
  day: string;
  today: string;
  chosen: CalendarEntry | null;
  chosenSpan: CycleSpan | null;
  chosenPaint: Paint | null;
  cycles: CalendarEntry[];
  spans: Map<string, CycleSpan>;
  onTap: (day: string) => void;
}) {
  const c = t.calendar;
  const role = chosenSpan ? dayRole(chosenSpan, day) : null;
  const isToday = day === today;
  const label = [
    longDay(day),
    ...cycles.map((e) => `${e.title}: ${roleWords(spans.get(e.cycleId)!, day)}`),
    isToday ? c.legend.today : null,
  ]
    .filter(Boolean)
    .join(". ");
  // "Tutti": the icons of what happens on the day across its cycles (last
  // days first, then pickups, then openings), at most DAY_ICONS and a count.
  const marks: (typeof Lock)[] = [];
  if (!chosen) {
    const roles = cycles.map((e) => dayRole(spans.get(e.cycleId)!, day));
    for (const r of roles) if (r.closes) marks.push(Lock);
    for (const r of roles) if (r.pickup) marks.push(Package);
    for (const r of roles) if (r.opens) marks.push(ShoppingBasket);
  }

  const number = (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center text-[16px] tabular-nums",
        role?.closes && chosenPaint
          ? cn("rounded-lg font-extrabold", chosenPaint.solid)
          : isToday
            ? "rounded-full bg-inverse font-bold text-inverse-foreground"
            : role?.pickup
              ? "rounded-lg font-bold text-foreground ring-2 ring-inverse"
              : role?.opens && chosenPaint
                ? cn("rounded-full font-bold text-foreground ring-2", chosenPaint.ring)
                : day < today
                  ? "text-muted-foreground"
                  : "text-foreground",
      )}
    >
      {Number(day.slice(8))}
    </span>
  );
  const Icon = role ? (role.pickup ? Package : role.closes ? Lock : role.opens ? ShoppingBasket : null) : null;
  const content = (
    <span className="relative flex h-14 flex-col items-center pt-1">
      {number}
      <span className="mt-0.5 flex h-4 items-center gap-0.5">
        {Icon && <Icon aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} />}
        {marks.slice(0, DAY_ICONS).map((M, i) => (
          <M key={i} aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} />
        ))}
        {marks.length > DAY_ICONS && <span className="text-label font-bold leading-none text-foreground">{c.moreLanes(marks.length - DAY_ICONS)}</span>}
      </span>
    </span>
  );
  if (cycles.length === 0) {
    return (
      <div aria-label={label} role="img" className="relative">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onTap(day)}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
    >
      {content}
    </button>
  );
}

function Legend({ chosen, paint }: { chosen: CalendarEntry | null; paint: Paint }) {
  const l = t.calendar.legend;
  const item = (mark: React.ReactNode, text: string) => (
    <li className="flex items-center gap-1.5 text-[13px] text-secondary-foreground">
      {mark}
      {text}
    </li>
  );
  return (
    <ul aria-label={t.calendar.legendLabel} className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-1 pt-2.5">
      {chosen ? (
        <>
          {item(<span aria-hidden className={cn("h-3 w-5 rounded-full", chosen.state === "planned" ? cn("border-2 border-dashed", paint.border) : paint.band)} />, chosen.state === "planned" ? l.tentative : l.window)}
          {item(<span aria-hidden className={cn("flex size-4 items-center justify-center rounded", paint.solid)} />, l.closes)}
        </>
      ) : (
        <>
          {item(<ShoppingBasket aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} />, l.opens)}
          {item(<Lock aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} />, l.closes)}
        </>
      )}
      {item(<Package aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} />, l.pickup)}
      {item(<span aria-hidden className="size-3.5 rounded-full bg-inverse" />, l.today)}
    </ul>
  );
}

/** A day with several cycles: what each does that day; tapping one chooses it. */
function DayList({
  day,
  cycles,
  spans,
  onChoose,
}: {
  day: string;
  cycles: CalendarEntry[];
  spans: Map<string, CycleSpan>;
  onChoose: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[17px] font-extrabold text-foreground first-letter:uppercase">{longDay(day)}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
        {cycles.map((e) => (
          <li key={e.cycleId}>
            <button type="button" onClick={() => onChoose(e.cycleId)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-foreground">{e.title}</span>
                <span className="block text-[15px] text-secondary-foreground first-letter:uppercase">{roleWords(spans.get(e.cycleId)!, day)}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-secondary-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Tutti": one row per cycle of the month; tapping it chooses it. */
function CycleRowButton({
  entry,
  span,
  today,
  onChoose,
}: {
  entry: CalendarEntry;
  span: CycleSpan;
  today: string;
  onChoose: (id: string) => void;
}) {
  const next = [span.open, span.close, ...span.pickups].filter((d): d is string => d !== null && d >= today).sort()[0] ?? span.last;
  return (
    <button type="button" onClick={() => onChoose(entry.cycleId)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <DateTile day={next} tone="neutral" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug text-foreground">{entry.title}</span>
        <span className="block text-[15px] text-foreground">{statusWord(entry)}</span>
        <span className="block text-[14px] text-secondary-foreground">{rangeLabel(span)}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-secondary-foreground" />
    </button>
  );
}

/** The chosen cycle in Home's words: when it opens, until when to order, when to collect, and what to do. */
function CycleDetail({ entry, span, today }: { entry: CalendarEntry; span: CycleSpan; today: string }) {
  const c = t.calendar;
  const h = t.home;
  const opens = entry.events.find((e) => e.kind === "opens");
  const closes = entry.events.find((e) => e.kind === "closes");
  const pickups = entry.events.filter((e) => e.kind === "pickup");
  const closeDays = span.close ? daysFrom(today, span.close) : null;
  const closeTone: DateTileTone =
    entry.state === "open" ? (closeDays !== null && closeDays <= 0 ? "urgent" : "open") : "neutral";
  const deadline = closes ? deadlineParts(closes.at) : null;
  const orderHref = `/ordine?cycleId=${encodeURIComponent(entry.cycleId)}`;

  const row = (key: string, day: string | null, tone: DateTileTone, Icon: typeof Lock, text: string, note?: string | null) => (
    <li key={key} className="flex items-center gap-3">
      {day ? <DateTile day={day} tone={tone} /> : <span aria-hidden className="size-12 shrink-0 rounded-xl bg-tint/[0.05]" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] text-foreground">
          <Icon aria-hidden className="size-4 shrink-0 text-secondary-foreground" strokeWidth={2.25} />
          {text}
        </span>
        {note && <span className="block text-[14px] font-semibold text-secondary-foreground">{note}</span>}
      </span>
    </li>
  );

  return (
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="px-4 pb-3.5 pt-3.5">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-extrabold leading-snug text-foreground">{entry.title}</h2>
            {entry.supplierName && <p className="text-[14px] text-secondary-foreground">{entry.supplierName}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant={entry.state === "open" && !entry.hasOrder ? "brand" : entry.pickedUp ? "accent" : "default"}>{statusWord(entry)}</Badge>
              {entry.tentative && <Badge>{c.tentative}</Badge>}
            </div>
          </div>
        </div>
        <ul className="space-y-2.5">
          {opens && row("opens", span.open, "neutral", ShoppingBasket, c.opensAt(formatLongDay(opens.at), formatTime(opens.at)))}
          {deadline &&
            row(
              "closes",
              span.close,
              closeTone,
              Lock,
              h.orderBy(deadline.day, deadline.time),
              entry.state === "open" && closeDays !== null ? (closeDays <= 0 ? h.lastDay : relativeDay(closeDays)) : null,
            )}
          {pickups.map((p) => row(p.at, p.day, "neutral", Package, h.pickupOn(formatPickupLong(p.at, p.endTime))))}
        </ul>
        {entry.state === "planned" && <PlannedPreview entry={entry} />}
      </div>
      {entry.state === "open" ? (
        <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-1.5">
          <span className="text-[15px] text-secondary-foreground">{entry.hasOrder ? c.status.ordered : h.notOrdered}</span>
          <Link
            href={orderHref}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[15px]",
              entry.hasOrder ? "border border-border bg-card font-semibold text-foreground" : "bg-primary font-bold text-primary-foreground",
            )}
          >
            {entry.hasOrder ? h.editCta : h.orderCta}
          </Link>
        </div>
      ) : (
        entry.href && (
          <Link
            href={entry.href}
            className="flex min-h-12 items-center justify-between border-t border-border bg-tint/[0.03] px-4 text-[15px] font-semibold text-primary-text"
          >
            {c.goHistory}
            <span aria-hidden>→</span>
          </Link>
        )
      )}
    </article>
  );
}

// A planned cycle: members cannot order yet, but see what is coming. The list
// folds away so a long one does not push the page down.
function PlannedPreview({ entry }: { entry: CalendarEntry }) {
  const c = t.calendar;
  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <p className="text-[14px] text-secondary-foreground">{c.plannedHint}</p>
      {entry.preview.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted-foreground">{c.previewEmpty}</p>
      ) : (
        <details className="group mt-1.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-primary-text [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
            {c.previewToggle(entry.preview.length)}
          </summary>
          <p className="mb-2 text-[13px] text-muted-foreground">{c.previewNote}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {entry.preview.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-[15px]">
                <span className="flex min-w-0 items-start gap-2">
                  {p.emoji && (
                    <span aria-hidden className="w-4.5 shrink-0 text-[16px] leading-tight">
                      {p.emoji}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-foreground">{p.name}</span>
                    {p.detail && <span className="block text-[13px] text-secondary-foreground">{p.detail}</span>}
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

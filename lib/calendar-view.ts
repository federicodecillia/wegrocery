// The /calendario page's model (components/calendar/cycle-calendar.tsx): one
// cycle at a time, or all of them in lanes. Pure, unit tested. Days are
// "YYYY-MM-DD" in the group's time zone (lib/calendar.ts).

import { monthOf, type CalendarEntry } from "./calendar";
import { deadlineDay } from "./home";

/** Where a cycle sits in time, by day: the ordering window and the pickups. */
export type CycleSpan = {
  /** The day the orders open; null when unknown. */
  open: string | null;
  /** The last day to order, as members read it (a close at 00:00 is the day before). */
  close: string | null;
  pickups: string[];
  /** First and last day of the whole span, opening to last pickup. */
  first: string;
  last: string;
};

export function spanOf(entry: CalendarEntry): CycleSpan {
  const open = entry.events.find((e) => e.kind === "opens")?.day ?? null;
  const closeEvent = entry.events.find((e) => e.kind === "closes");
  const close = closeEvent ? deadlineDay(new Date(closeEvent.at)) : null;
  const pickups = entry.events.filter((e) => e.kind === "pickup").map((e) => e.day);
  const days = [open, close, ...pickups].filter((d): d is string => d !== null).sort();
  return { open, close, pickups, first: days[0] ?? "9999-12-31", last: days[days.length - 1] ?? "0000-01-01" };
}

/** The cycles whose span touches the month, by their first day. */
export function cyclesInMonth(entries: ReadonlyArray<CalendarEntry>, month: string): CalendarEntry[] {
  return entries
    .map((entry) => ({ entry, span: spanOf(entry) }))
    .filter(({ span }) => monthOf(span.first) <= month && month <= monthOf(span.last))
    .sort((a, b) => a.span.first.localeCompare(b.span.first) || a.entry.title.localeCompare(b.entry.title))
    .map(({ entry }) => entry);
}

/**
 * The cycle the page opens on in a month, as Home would put it first: the
 * open one closing soonest, else the next one to collect, else the next
 * planned one, else the month's first.
 */
export function defaultCycleId(entries: ReadonlyArray<CalendarEntry>, month: string): string | null {
  const inMonth = cyclesInMonth(entries, month);
  const by = (pick: (s: CycleSpan) => string | null) => (a: CalendarEntry, b: CalendarEntry) =>
    (pick(spanOf(a)) ?? "9999").localeCompare(pick(spanOf(b)) ?? "9999");
  const open = inMonth.filter((e) => e.state === "open").sort(by((s) => s.close));
  if (open[0]) return open[0].cycleId;
  const toCollect = inMonth.filter((e) => e.state === "closed" && e.hasOrder && !e.pickedUp).sort(by((s) => s.pickups[0] ?? null));
  if (toCollect[0]) return toCollect[0].cycleId;
  const planned = inMonth.filter((e) => e.state === "planned").sort(by((s) => s.open));
  if (planned[0]) return planned[0].cycleId;
  return inMonth[0]?.cycleId ?? null;
}

/** What a day is for one cycle. */
export type DayRole = {
  /** Between opening and last day to order, both included. */
  window: boolean;
  opens: boolean;
  closes: boolean;
  pickup: boolean;
};

export function dayRole(span: CycleSpan, day: string): DayRole {
  return {
    window: span.open !== null && span.close !== null && span.open <= day && day <= span.close,
    opens: span.open === day,
    closes: span.close === day,
    pickup: span.pickups.includes(day),
  };
}

export function hasRole(role: DayRole): boolean {
  return role.window || role.opens || role.closes || role.pickup;
}

/** The cycles that have something on the day (its window, its opening, close or a pickup). */
export function cyclesOnDay(entries: ReadonlyArray<CalendarEntry>, day: string): CalendarEntry[] {
  return entries.filter((e) => hasRole(dayRole(spanOf(e), day)));
}

/**
 * A lane per cycle so that overlapping spans never share one: the lowest
 * free lane, in the order given (cyclesInMonth's).
 */
export function assignLanes(entries: ReadonlyArray<CalendarEntry>): Map<string, number> {
  const ends: string[] = [];
  const lanes = new Map<string, number>();
  for (const entry of entries) {
    const span = spanOf(entry);
    let lane = ends.findIndex((end) => end < span.first);
    if (lane === -1) lane = ends.length;
    ends[lane] = span.last;
    lanes.set(entry.cycleId, lane);
  }
  return lanes;
}

/** The part of [from, to] inside a week (seven days): its columns, and whether it starts or ends there. */
export type WeekSegment = { start: number; length: number; startsHere: boolean; endsHere: boolean };

export function weekSegment(week: ReadonlyArray<string>, from: string, to: string): WeekSegment | null {
  const inside = week.map((d, i) => (d >= from && d <= to ? i : -1)).filter((i) => i >= 0);
  if (inside.length === 0) return null;
  return {
    start: inside[0],
    length: inside.length,
    startsHere: week[inside[0]] === from,
    endsHere: week[inside[inside.length - 1]] === to,
  };
}

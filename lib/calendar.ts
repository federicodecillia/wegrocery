// The order calendar (/calendario): the cycles a member can see, past and
// open, laid out by day. Pure (no I/O): the rows come from
// lib/db/calendar.ts, the page and components/calendar/ draw the result.
// Days are calendar days in the group's time zone ("YYYY-MM-DD"), worked out
// on the server so the grid never depends on the device's clock.

import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/i18n/zoned-time";

export type CalendarCycleRow = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  status: string;
  orderOpenAt: Date | null;
  orderCloseAt: Date | null;
  createdAt: Date;
  pickupDate: Date | null;
  pickupEndTime: string | null;
  pickup2Date: Date | null;
  pickup2EndTime: string | null;
  productCount: number;
  /** The member (or their family account) has an order on it. */
  hasOrder: boolean;
  /** An admin marked the order as collected (Admin → Ciclo → Ritiri). */
  pickedUp: boolean;
};

export type CalendarEventKind = "opens" | "closes" | "pickup";

export type CalendarEvent = {
  kind: CalendarEventKind;
  /** ISO instant. */
  at: string;
  /** "YYYY-MM-DD" in the group's time zone. */
  day: string;
  /** "HH:mm" end of a pickup window. */
  endTime: string | null;
  /** The second pickup day of the cycle. */
  second: boolean;
};

/**
 * Where the cycle stands for a member: taking orders, closed with the pickup
 * still ahead, or over (the last pickup window ended, or a closed cycle with
 * no pickup day).
 */
export type CalendarState = "open" | "closed" | "past";

export type CalendarEntry = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  state: CalendarState;
  events: CalendarEvent[];
  productCount: number;
  hasOrder: boolean;
  pickedUp: boolean;
  /** Where the card leads: the order form, the cycle in Storico, or nowhere. */
  href: string | null;
};

/** How far back the calendar reaches. */
export const CALENDAR_PAST_DAYS = 365;

/** The calendar day of an instant in the group's time zone. */
export function dayOf(at: Date): string {
  return utcToZonedLocalInput(at).slice(0, 10);
}

/** "YYYY-MM" of a day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** The month after (or before, with -1) "YYYY-MM". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

// The end of a pickup window: its end time on the day, else the end of the day.
function pickupEnd(start: Date, endTime: string | null): Date {
  const day = dayOf(start);
  const end = endTime ? zonedLocalToUtc(`${day}T${endTime}`) : null;
  if (end && end.getTime() >= start.getTime()) return end;
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return zonedLocalToUtc(`${next.toISOString().slice(0, 10)}T00:00`) ?? start;
}

function stateOf(row: CalendarCycleRow, now: Date): CalendarState {
  const closed = row.status !== "open" || (row.orderCloseAt !== null && row.orderCloseAt.getTime() <= now.getTime());
  if (!closed) return "open";
  const ends = [
    row.pickupDate && pickupEnd(row.pickupDate, row.pickupEndTime),
    row.pickup2Date && pickupEnd(row.pickup2Date, row.pickup2EndTime),
  ].filter((d): d is Date => d instanceof Date);
  if (ends.length === 0) return row.status === "open" ? "closed" : "past";
  return ends.some((end) => end.getTime() > now.getTime()) ? "closed" : "past";
}

function eventsOf(row: CalendarCycleRow): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const add = (kind: CalendarEventKind, at: Date | null, endTime: string | null = null, second = false) => {
    if (at) events.push({ kind, at: at.toISOString(), day: dayOf(at), endTime, second });
  };
  add("opens", row.orderOpenAt ?? row.createdAt);
  add("closes", row.orderCloseAt);
  add("pickup", row.pickupDate, row.pickupEndTime);
  add("pickup", row.pickup2Date, row.pickup2EndTime, true);
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** The cycles as calendar entries. Cancelled cycles stay in Storico only. */
export function buildCalendar(rows: ReadonlyArray<CalendarCycleRow>, now: Date): CalendarEntry[] {
  return rows
    .filter((r) => r.status === "open" || r.status === "closed")
    .map((row) => {
      const state = stateOf(row, now);
      const href =
        state === "open"
          ? `/ordine?cycleId=${encodeURIComponent(row.cycleId)}`
          : row.hasOrder
            ? `/storico?cycleId=${encodeURIComponent(row.cycleId)}`
            : null;
      return {
        cycleId: row.cycleId,
        title: row.title,
        supplierName: row.supplierName,
        state,
        events: eventsOf(row),
        productCount: row.productCount,
        hasOrder: row.hasOrder,
        pickedUp: row.pickedUp,
        href,
      };
    });
}

export type DayCell = { day: string; inMonth: boolean };

/** The weeks of a month, Monday first, padded with the days of the months around it. */
export function monthGrid(month: string): DayCell[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay: 0 = Sunday. Monday-first offset.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m - 1, 1 - lead));
  const weeks: DayCell[][] = [];
  const cursor = new Date(start);
  do {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = cursor.toISOString().slice(0, 10);
      week.push({ day, inMonth: monthOf(day) === month });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (monthOf(cursor.toISOString().slice(0, 10)) === month);
  return weeks;
}

/** The kinds of event on each day, for the dots of the grid. */
export function eventKindsByDay(entries: ReadonlyArray<CalendarEntry>): Map<string, Set<CalendarEventKind>> {
  const out = new Map<string, Set<CalendarEventKind>>();
  for (const entry of entries) {
    for (const event of entry.events) {
      const kinds = out.get(event.day) ?? new Set<CalendarEventKind>();
      kinds.add(event.kind);
      out.set(event.day, kinds);
    }
  }
  return out;
}

export type CalendarScope = { month: string; day?: string | null };

/** Whether an event falls in the month, or on the day when one is chosen. */
export function eventInScope(event: Pick<CalendarEvent, "day">, scope: CalendarScope): boolean {
  return scope.day ? event.day === scope.day : monthOf(event.day) === scope.month;
}

/**
 * The entries with an event in the scope, by their first such event. Each
 * keeps all its events, so a card shows the whole cycle (it opened last
 * month, the pickup is this month).
 */
export function entriesIn(entries: ReadonlyArray<CalendarEntry>, scope: CalendarScope): CalendarEntry[] {
  const firstIn = (entry: CalendarEntry) => entry.events.find((e) => eventInScope(e, scope))?.at ?? null;
  return entries
    .map((entry) => ({ entry, first: firstIn(entry) }))
    .filter((x): x is { entry: CalendarEntry; first: string } => x.first !== null)
    .sort((a, b) => a.first.localeCompare(b.first))
    .map((x) => x.entry);
}

/** Months ahead of today the calendar always reaches, events or not ("nothing planned yet" is news too). */
export const CALENDAR_AHEAD_MONTHS = 2;

/** The months the calendar can move across: from the first event to the last, today's and the next ones always in. */
export function monthRange(entries: ReadonlyArray<CalendarEntry>, today: string): { first: string; last: string } {
  let first = monthOf(today);
  let last = shiftMonth(first, CALENDAR_AHEAD_MONTHS);
  for (const entry of entries) {
    for (const event of entry.events) {
      const month = monthOf(event.day);
      if (month < first) first = month;
      if (month > last) last = month;
    }
  }
  return { first, last };
}

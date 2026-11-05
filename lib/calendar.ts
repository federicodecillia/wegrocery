// The order calendar (/calendario): the cycles a member can see, planned,
// open and past, laid out by day. Pure (no I/O): the rows come from
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
  /** The dates may still move (a planned cycle, drizzle/0048_planned_cycles.sql). */
  datesTentative: boolean;
  /** "Ritiro da confermare" (drizzle/0050_pickup_tentative.sql). */
  pickupTentative?: boolean;
};

/** A product of a planned cycle, shown as a preview: name, detail, price. */
export type PreviewProduct = { name: string; detail: string | null; price: number; emoji: string | null };

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
 * Where the cycle stands for a member: planned (orders not open yet), taking
 * orders, closed with the pickup still ahead, or over (the last pickup window
 * ended, or a closed cycle with no pickup day).
 */
export type CalendarState = "planned" | "open" | "closed" | "past";

export type CalendarEntry = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  state: CalendarState;
  events: CalendarEvent[];
  productCount: number;
  hasOrder: boolean;
  pickedUp: boolean;
  /** "Date indicative": only on a planned cycle. */
  tentative: boolean;
  /** The pickup is the expected one, "da confermare". */
  pickupTentative: boolean;
  /** The products of a planned cycle, as a preview; empty otherwise. */
  preview: PreviewProduct[];
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
  if (row.status === "planned") return "planned";
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

/** The statuses the calendar shows. Cancelled cycles stay in Storico only. */
export const CALENDAR_STATUSES = ["planned", "open", "closed"] as const;

/** The cycles as calendar entries, with the preview of each planned one (`previews`, by cycle). */
export function buildCalendar(
  rows: ReadonlyArray<CalendarCycleRow>,
  now: Date,
  previews: ReadonlyMap<string, PreviewProduct[]> = new Map(),
): CalendarEntry[] {
  return rows
    .filter((r) => (CALENDAR_STATUSES as readonly string[]).includes(r.status))
    .map((row) => {
      const state = stateOf(row, now);
      const events = eventsOf(row);
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
        events,
        productCount: row.productCount,
        hasOrder: row.hasOrder,
        pickedUp: row.pickedUp,
        tentative: state === "planned" && row.datesTentative,
        pickupTentative: Boolean(row.pickupTentative) && events.some((e) => e.kind === "pickup"),
        preview: state === "planned" ? (previews.get(row.cycleId) ?? []) : [],
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

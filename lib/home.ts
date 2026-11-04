// Home's one list of cycles (app/page.tsx): each cycle once, in the group of
// what the member has to do next. Pure, unit tested; the rows come from the
// calendar (lib/calendar.ts), the open cycles' order data from the page.

import { t } from "@/lib/i18n";
import { isZonedMidnight } from "@/lib/i18n/deadline";
import { dayOf, type CalendarEntry } from "./calendar";

/** Planned cycles shown under "In arrivo"; the rest is in /calendario. */
export const COMING_UP_ON_HOME = 3;

export type HomeGroups = {
  /** Closed (or past their deadline), with the member's order, the pickup still ahead and not collected: by pickup. */
  toCollect: CalendarEntry[];
  /** Planned, by opening: at most COMING_UP_ON_HOME. */
  comingUp: CalendarEntry[];
};

const firstAt = (entry: CalendarEntry, kind: "opens" | "pickup") => entry.events.find((e) => e.kind === kind)?.at ?? "9999";

/**
 * The cycles of "Da ritirare" and "In arrivo". The open ones ("Da ordinare")
 * come from the page's open cycles, which carry the order and payment data.
 */
export function homeGroups(entries: ReadonlyArray<CalendarEntry>): HomeGroups {
  const toCollect = entries
    .filter((e) => e.state === "closed" && e.hasOrder && !e.pickedUp)
    .sort((a, b) => firstAt(a, "pickup").localeCompare(firstAt(b, "pickup")));
  const comingUp = entries
    .filter((e) => e.state === "planned")
    .sort((a, b) => firstAt(a, "opens").localeCompare(firstAt(b, "opens")))
    .slice(0, COMING_UP_ON_HOME);
  return { toCollect, comingUp };
}

/** Calendar days from `today` to `day` ("YYYY-MM-DD" both): 0 today, 1 tomorrow. */
export function daysFrom(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * The day a deadline belongs to as members read it: a close at 00:00 is the
 * end of the day before (formatDeadline writes it 23:59).
 */
export function deadlineDay(closeAt: Date): string {
  return dayOf(isZonedMidnight(closeAt) ? new Date(closeAt.getTime() - 60_000) : closeAt);
}

/** "oggi", "domani", "mancano 3 giorni": counted in calendar days, never in blocks of 24 hours. */
export function relativeDay(days: number): string {
  const h = t.home;
  if (days <= 0) return h.today;
  if (days === 1) return h.tomorrow;
  return h.daysLeft(days);
}

import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, formatTime } from "./format";
import { utcToZonedLocalInput } from "./zoned-time";

// One way to write a cycle's deadline and pickup everywhere (member pages,
// admin cards, the cycle_opened notification and email, the supplier email).
// The stored value never changes: only how it reads.

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Midnight in the app zone: a pickup with no time, or a deadline "at the end of the day before". */
export function isZonedMidnight(d: Date): boolean {
  return utcToZonedLocalInput(d).endsWith("T00:00");
}

/**
 * "lun 13 ott, 23:59". A close at 00:00 reads as 23:59 of the day before,
 * which is what the admin meant ("orders until Monday night").
 */
export function formatDeadline(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const shown = isZonedMidnight(d) ? new Date(d.getTime() - MINUTE_MS) : d;
  return formatDateTime(shown, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "Chiude tra 5 giorni", "Chiude tra 3 ore", "Chiude tra 20 minuti". */
export function closesIn(closeAt: Date | string, now: Date): string {
  const ms = new Date(closeAt).getTime() - now.getTime();
  if (ms <= 0) return t.cycle.closingNow;
  if (ms >= DAY_MS) return t.cycle.closesInDays(Math.floor(ms / DAY_MS));
  if (ms >= HOUR_MS) return t.cycle.closesInHours(Math.floor(ms / HOUR_MS));
  return t.cycle.closesInMinutes(Math.max(1, Math.floor(ms / MINUTE_MS)));
}

/** The countdown boxes are worth their space only in the last day. */
export function isLastDay(closeAt: Date | string, now: Date): boolean {
  const ms = new Date(closeAt).getTime() - now.getTime();
  return ms > 0 && ms < DAY_MS;
}

/**
 * "mer 15 ott · 18:00–20:00", or the date alone for a pickup with no time.
 * `long` writes the weekday and month in full (emails).
 */
export function formatPickupSlot(value: Date | string, endTime: string | null, long = false): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const day = formatDate(d, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
  if (isZonedMidnight(d)) return day;
  const start = formatTime(d);
  return `${day} · ${endTime ? `${start}–${endTime}` : start}`;
}

/**
 * The cycle's pickups on one line when they share the hours:
 * "mer 15 e gio 16 ott · 18:00–20:00"; otherwise each with its own.
 */
export function formatPickups(
  first: { date: Date | string; endTime: string | null } | null,
  second: { date: Date | string; endTime: string | null } | null,
): string[] {
  if (!first) return [];
  if (!second) return [formatPickupSlot(first.date, first.endTime)];
  const a = new Date(first.date);
  const b = new Date(second.date);
  const sameHours = (isZonedMidnight(a) && isZonedMidnight(b)) ||
    (!isZonedMidnight(a) && formatTime(a) === formatTime(b) && (first.endTime ?? "") === (second.endTime ?? ""));
  if (!sameHours) return [formatPickupSlot(a, first.endTime), formatPickupSlot(b, second.endTime)];
  const hours = isZonedMidnight(a) ? "" : ` · ${first.endTime ? `${formatTime(a)}–${first.endTime}` : formatTime(a)}`;
  const sameMonth = formatDate(a, { month: "short" }) === formatDate(b, { month: "short" });
  const left = formatDate(a, sameMonth ? { weekday: "short", day: "numeric" } : { weekday: "short", day: "numeric", month: "short" });
  const right = formatDate(b, { weekday: "short", day: "numeric", month: "short" });
  return [`${t.cycle.pickupDays(left, right)}${hours}`];
}

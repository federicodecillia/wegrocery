// "Aggiungi al calendario" on /calendario: a cycle's dates as an iCalendar
// file (RFC 5545) that phones open in their calendar app. Pure, unit tested;
// the route is app/calendario/ics/[cycleId]/route.ts.

import { isZonedMidnight } from "@/lib/i18n/deadline";
import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/i18n/zoned-time";

export type IcsCycle = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  /** Planned cycles: when the orders open; null otherwise. */
  opensAt: Date | null;
  closeAt: Date | null;
  pickups: { at: Date; endTime: string | null }[];
  /** The calendar page, linked from each event. */
  url: string | null;
};

export type IcsText = {
  opens: (title: string) => string;
  closes: (title: string) => string;
  pickup: (title: string) => string;
  closesAlarm: string;
};

const MINUTE = 60_000;

/** 20261108T200000Z */
function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** 20261108, the day in the group's time zone. */
function dateOnly(d: Date): string {
  return utcToZonedLocalInput(d).slice(0, 10).replace(/-/g, "");
}

function nextDay(yyyymmdd: string): string {
  const d = new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** RFC 5545 text: backslash, semicolon, comma and line breaks escaped. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next one, after a space. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The cycle's dates as a VCALENDAR: the opening (planned), the last moment to order, each pickup. */
export function buildCycleIcs(cycle: IcsCycle, text: IcsText, now: Date, productId = "-//WeGrocery//Calendario ordini//IT"): string {
  const name = cycle.supplierName ? `${cycle.title} (${cycle.supplierName})` : cycle.title;
  const stamp = utc(now);
  const events: string[][] = [];
  const event = (uid: string, lines: string[]) =>
    events.push([
      "BEGIN:VEVENT",
      `UID:${cycle.cycleId}-${uid}@wegrocery`,
      `DTSTAMP:${stamp}`,
      ...lines,
      ...(cycle.url ? [`URL:${cycle.url}`] : []),
      "END:VEVENT",
    ]);

  if (cycle.opensAt) {
    event("opens", [`DTSTART:${utc(cycle.opensAt)}`, `DTEND:${utc(new Date(cycle.opensAt.getTime() + 30 * MINUTE))}`, `SUMMARY:${escapeText(text.opens(name))}`]);
  }
  if (cycle.closeAt) {
    // A close at 00:00 is the end of the day before: the event sits just before it.
    const end = cycle.closeAt;
    event("closes", [
      `DTSTART:${utc(new Date(end.getTime() - 30 * MINUTE))}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${escapeText(text.closes(name))}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(text.closesAlarm)}`,
      "TRIGGER:-PT3H",
      "END:VALARM",
    ]);
  }
  cycle.pickups.forEach((p, i) => {
    const uid = `pickup-${i + 1}`;
    const summary = `SUMMARY:${escapeText(text.pickup(name))}`;
    if (isZonedMidnight(p.at)) {
      const day = dateOnly(p.at);
      event(uid, [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(day)}`, summary]);
      return;
    }
    const day = utcToZonedLocalInput(p.at).slice(0, 10);
    const end = (p.endTime && zonedLocalToUtc(`${day}T${p.endTime}`)) || new Date(p.at.getTime() + 60 * MINUTE);
    event(uid, [`DTSTART:${utc(p.at)}`, `DTEND:${utc(end.getTime() > p.at.getTime() ? end : new Date(p.at.getTime() + 60 * MINUTE))}`, summary]);
  });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${productId}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events.flat(), "END:VCALENDAR"];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "ordine-verdura-di-stagione.ics" */
export function icsFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "ordine"}.ics`;
}

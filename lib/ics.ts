// "Aggiungi al calendario": events as an iCalendar file (RFC 5545) that a
// phone opens in its calendar app, with a reminder where it helps. Pure, no
// dependencies, unit tested; the app serves it from a route (README).
//
// FlyLabs Kit registry module `ics` 1.0, as is (it came from here). The
// cycles' events are lib/calendar-ics.ts; the route app/calendario/ics/[cycleId]/route.ts.

/** An event at a time (UTC instants), or on a whole day ("YYYY-MM-DD" in the app's time zone). */
export type IcsEvent = {
  /** Stable and unique, so a second download updates the event instead of adding one: "<id>-<kind>@<app>". */
  uid: string;
  summary: string;
  description?: string | null;
  /** The page in the app the event belongs to. */
  url?: string | null;
  /** A reminder this many minutes before the start, with this text. */
  alarm?: { minutesBefore: number; text: string } | null;
} & ({ start: Date; end: Date } | { day: string });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 20261108T200000Z */
function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** RFC 5545 text: backslash, semicolon, comma and line breaks escaped. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next one, after a space; a character is never split. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = encoder.encode(char).length;
    // The space that opens a continuation line counts.
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

function eventLines(e: IcsEvent, stamp: string): string[] {
  let when: string[];
  if ("day" in e) {
    if (!DAY.test(e.day)) throw new Error(`ics: not a day: ${e.day}`);
    const d = e.day.replace(/-/g, "");
    when = [`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nextDay(e.day).replace(/-/g, "")}`];
  } else {
    // A calendar refuses an event that ends before it starts: at least a minute.
    const end = e.end.getTime() > e.start.getTime() ? e.end : new Date(e.start.getTime() + 60_000);
    when = [`DTSTART:${utc(e.start)}`, `DTEND:${utc(end)}`];
  }
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.alarm
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.alarm.text)}`, `TRIGGER:-PT${Math.max(0, Math.round(e.alarm.minutesBefore))}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
  ];
}

/**
 * The events as a VCALENDAR, CRLF ended and folded. `productId`: the app's
 * PRODID, "-//<Company>//<App>//<LANG>". `now`: the DTSTAMP, passed in so
 * tests are stable.
 */
export function buildIcs(events: ReadonlyArray<IcsEvent>, opts: { productId: string; now: Date }): string {
  const stamp = utc(opts.now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((e) => eventLines(e, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "verdura-di-stagione.ics": the name the phone shows; `fallback` when nothing is left of the title. */
export function icsFileName(title: string, fallback = "evento"): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${slug || fallback}.ics`;
}

/** The response headers of the route that serves the file. */
export function icsHeaders(fileName: string): Record<string, string> {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
  };
}

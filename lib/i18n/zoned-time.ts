import { APP_TIME_ZONE } from "./format";

// Conversions between wall-clock time in the app zone (what admins type into
// <input type="datetime-local"> and read on screen) and absolute instants
// (what Postgres timestamptz stores). Both directions go through Intl with an
// explicit zone, so the result never depends on the process time zone (UTC on
// Vercel, Europe/Rome in the browser).

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

type WallParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallPartsAt(ms: number, timeZone: string): WallParts {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(ms))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

// Offset of `timeZone` from UTC at instant `ms`, in milliseconds.
function offsetAt(ms: number, timeZone: string): number {
  const w = wallPartsAt(ms, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const WITH_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Converts a wall-clock string ("YYYY-MM-DDTHH:mm[:ss]", the value of a
 * datetime-local input) in `timeZone` to the instant it denotes. Strings that
 * already carry "Z" or an offset are taken as-is. Returns null for empty or
 * invalid input.
 *
 * DST: a time repeated by the October fall-back resolves to the earlier
 * instant; a time skipped by the March spring-forward shifts forward by the
 * gap (02:30 becomes 03:30), matching Temporal's "compatible" disambiguation.
 */
export function zonedLocalToUtc(local: string, timeZone: string = APP_TIME_ZONE): Date | null {
  if (!local) return null;
  if (WITH_OFFSET_RE.test(local)) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = NAIVE_RE.exec(local);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] ? Number(m[6]) : 0;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Reject overflowing fields (Feb 30, hour 25) that Date.UTC would roll over.
  const check = new Date(wallAsUtc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }

  // The offset in force a day before and a day after bracket any DST switch.
  const offsetBefore = offsetAt(wallAsUtc - DAY_MS, timeZone);
  const offsetAfter = offsetAt(wallAsUtc + DAY_MS, timeZone);
  const candidates = [wallAsUtc - offsetBefore, wallAsUtc - offsetAfter].filter(
    (t) => t + offsetAt(t, timeZone) === wallAsUtc,
  );
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // Skipped wall time: apply the pre-transition offset, which lands after the gap.
  return new Date(wallAsUtc - offsetBefore);
}

/**
 * Renders an instant as the "YYYY-MM-DDTHH:mm" wall-clock value of
 * `timeZone`, ready for a datetime-local input's defaultValue (slice(0, 10)
 * for a date input, slice(11, 16) for a time). Returns "" for missing or
 * invalid input.
 */
export function utcToZonedLocalInput(
  value: Date | string | null | undefined,
  timeZone: string = APP_TIME_ZONE,
): string {
  if (!value) return "";
  const ms = (typeof value === "string" ? new Date(value) : value).getTime();
  if (Number.isNaN(ms)) return "";
  const w = wallPartsAt(ms, timeZone);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p2(w.month)}-${p2(w.day)}T${p2(w.hour)}:${p2(w.minute)}`;
}

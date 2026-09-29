import { brand } from "@/lib/brand";

const LOCALE_TAG: Record<"it" | "en", string> = { it: "it-IT", en: "en-GB" };
const tag = LOCALE_TAG[brand.locale];

const DEFAULT_TIME_ZONE = "Europe/Rome";

// Returns `value` when it is a zone Intl understands, else the default, so a
// typo in the env var degrades to Rome time instead of a RangeError on render.
export function resolveTimeZone(value: string | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// The zone every date is shown and entered in. Pinned explicitly because the
// Vercel server runs in UTC while members browse from Europe/Rome: without it
// SSR and hydration render different times (React error #418).
// NEXT_PUBLIC_* is inlined at build time, so server and client always agree.
export const APP_TIME_ZONE = resolveTimeZone(process.env.NEXT_PUBLIC_TIME_ZONE);

export function formatMoney(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(tag, { style: "currency", currency: brand.currency }).format(n);
}

// Balances and ledger movements: "+" for a credit, "-" for a debit, no sign
// on zero. Prices and order totals stay on formatMoney.
export function formatSignedMoney(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: brand.currency,
    signDisplay: "exceptZero",
  }).format(n);
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(tag, {
    ...(opts ?? { day: "numeric", month: "short", year: "numeric" }),
    timeZone: APP_TIME_ZONE,
  });
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
}

export function formatDateTime(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(tag, {
    ...(opts ?? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    timeZone: APP_TIME_ZONE,
  });
}

export function formatNumber(value: number, maxDecimals = 3): string {
  return new Intl.NumberFormat(tag, { maximumFractionDigits: maxDecimals }).format(value);
}

// Pre-fills for editable numeric <input>s: Italian admins type decimal commas,
// everyone else gets dots. The parse direction tolerates both separators.
export function formatDecimalInput(value: number | string): string {
  const s = typeof value === "number" ? String(value) : value;
  return brand.locale === "it" ? s.replace(".", ",") : s;
}

import { createHmac } from "node:crypto";

// The caller's IP for rate limits, and the hash stored in its place: the
// registry never keeps a raw address. On Vercel `x-vercel-forwarded-for` is
// set by the platform and cannot be forged; elsewhere the first hop of
// `x-forwarded-for`. Without either every request shares one bucket.

export interface HeaderSource {
  get(name: string): string | null;
}

export function clientIp(headers: HeaderSource): string {
  const raw = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "";
  const first = raw.split(",")[0]?.trim();
  return first || "unknown";
}

export function hashIp(ip: string, key: string | null): string {
  return createHmac("sha256", key ?? "wegrocery-console").update(`ip\0${ip}`).digest("hex").slice(0, 32);
}

/** Whether another attempt is allowed, given the recent count in the window. */
export function underLimit(recentCount: number, max: number): boolean {
  return recentCount < max;
}

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;
export const INTAKE_MAX_PER_HOUR = 3;

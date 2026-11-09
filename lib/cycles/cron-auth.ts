import { createHash, timingSafeEqual } from "node:crypto";
import { MIN_SECRET_LENGTH } from "@/lib/instance-stats/constants";

// Vercel Cron calls with `Authorization: Bearer ${CRON_SECRET}`. Without a
// secret of at least MIN_SECRET_LENGTH characters the cron routes stay closed.
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  const key = secret?.trim() ?? "";
  if (key.length < MIN_SECRET_LENGTH || !header) return false;
  // Hashing first gives equal lengths, so the comparison takes the same time.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${key}`));
}

/** Whether the cached next opening asks for a look at the database now. */
export function openingDue(nextOpening: string | null, now: Date): boolean {
  return nextOpening !== null && new Date(nextOpening).getTime() <= now.getTime();
}

/** Whether this deploy opens planned cycles by itself: a long enough CRON_SECRET (see vercel.json). */
export function autoOpenEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.CRON_SECRET?.trim().length ?? 0) >= MIN_SECRET_LENGTH;
}

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";

// Caps on the sign-in emails, on top of Better Auth's per-IP limit: a
// member's inbox cannot be flooded with links, and the explanations sent to
// strangers cannot be used to spam arbitrary addresses or burn the group's
// email quota. Counters live in auth_rate_limits under keys of their own; the
// address is stored hashed.

export type EmailCaps = {
  linksPerAddressPerHour: number;
  noticesPerAddressPerDay: number;
  noticesPerDay: number;
};

export const DEFAULT_EMAIL_CAPS: EmailCaps = {
  linksPerAddressPerHour: 5,
  noticesPerAddressPerDay: 1,
  noticesPerDay: 50,
};

type Db = ReturnType<typeof getDb>;

// Counts one more in the window and says whether it is still within `max`.
async function take(db: Db, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const now = Date.now();
  const { rows } = await db.execute<{ count: number }>(sql`
    INSERT INTO auth_rate_limits (id, key, count, last_request)
    VALUES (gen_random_uuid()::text, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN auth_rate_limits.last_request < ${now - windowSeconds * 1000} THEN 1 ELSE auth_rate_limits.count + 1 END,
      last_request = CASE WHEN auth_rate_limits.last_request < ${now - windowSeconds * 1000} THEN ${now} ELSE auth_rate_limits.last_request END
    RETURNING count
  `);
  return (rows[0]?.count ?? 1) <= max;
}

const hash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

export async function mayEmail(db: Db, email: string, withLink: boolean, caps: EmailCaps): Promise<boolean> {
  if (withLink) return take(db, `auth-email:link:${hash(email)}`, 3600, caps.linksPerAddressPerHour);
  if (!(await take(db, `auth-email:notice:${hash(email)}`, 86400, caps.noticesPerAddressPerDay))) return false;
  const day = new Date().toISOString().slice(0, 10);
  return take(db, `auth-email:notice-day:${day}`, 86400, caps.noticesPerDay);
}

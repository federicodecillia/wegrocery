import { sql } from "drizzle-orm";
import { brandContrastWarnings } from "@/lib/brand";
import { getBrand, getGroupIdentity } from "@/lib/brand/get-brand";
import { brandUnknownFields } from "@/lib/brand/parse";
import { configStatus, type ConfigItem } from "@/lib/config-status";
import { getDb } from "@/lib/db/client";

// The configuration status of this deploy (lib/config-status.ts) with the
// facts only the server knows: the migrations the database has applied and
// whether it has an admin. The brand parsed, or the app would not be running.
export async function getConfigStatus(): Promise<ConfigItem[]> {
  let applied: string[] | null = null;
  try {
    const { rows } = await getDb().execute<{ name: string }>(sql`SELECT name FROM _migrations`);
    applied = rows.map((r) => r.name);
  } catch {
    // No _migrations table (a schema pushed by hand) or no database.
  }
  let hasActiveAdmin: boolean | null = null;
  try {
    const { rows } = await getDb().execute(sql`SELECT 1 FROM members WHERE role = 'admin' AND active LIMIT 1`);
    hasActiveAdmin = rows.length > 0;
  } catch {
    // No database: the database item already says so.
  }
  const [brand, identity] = await Promise.all([getBrand(), getGroupIdentity()]);
  return configStatus(process.env, {
    appliedMigrations: applied,
    brandWarnings: brandContrastWarnings(brand.theme),
    identityInApp: Boolean(identity.overrides.appName),
    brandError: null,
    brandUnknownFields: brandUnknownFields(process.env.NEXT_PUBLIC_BRAND_JSON),
    hasActiveAdmin,
  });
}

import { sql } from "drizzle-orm";
import { brand, brandContrastWarnings } from "@/lib/brand";
import { configStatus, type ConfigItem } from "@/lib/config-status";
import { getDb } from "@/lib/db/client";

// The configuration status of this deploy (lib/config-status.ts) with the
// facts only the server knows: the migrations the database has applied.
export async function getConfigStatus(): Promise<ConfigItem[]> {
  let applied: string[] | null = null;
  try {
    const { rows } = await getDb().execute<{ name: string }>(sql`SELECT name FROM _migrations`);
    applied = rows.map((r) => r.name);
  } catch {
    // No _migrations table (a schema pushed by hand) or no database.
  }
  return configStatus(process.env, { appliedMigrations: applied, brandWarnings: brandContrastWarnings(brand.theme) });
}

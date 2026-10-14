import { and, desc, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { usageEvents } from "@/lib/db/schema";
import { reportError } from "@/lib/observability";

// Usage measured with our own minimal counters (FlyLabs Playbook 7.8): how
// many times something happened on a day, never who or what was written. The
// demo records nothing, and a failure here never reaches the caller.

export const USAGE_EVENTS = [
  "login",
  "order_saved",
  "order_cancelled",
  "topup_started",
  "card_order_started",
  "cycle_created",
  "cycle_closed",
  "welcome_closed",
] as const;

export type UsageEvent = (typeof USAGE_EVENTS)[number];

export const USAGE_RETENTION_DAYS = 400;

export function isUsageEvent(name: string): name is UsageEvent {
  return (USAGE_EVENTS as readonly string[]).includes(name);
}

/** Counts one occurrence today (UTC). Never throws; a no-op in the demo. */
export async function recordUsage(name: UsageEvent): Promise<void> {
  if (process.env.DEMO_MODE === "true") return;
  try {
    const db = getDb();
    await db
      .insert(usageEvents)
      .values({ day: sql`(now() at time zone 'UTC')::date`, name, count: 1 })
      .onConflictDoUpdate({
        target: [usageEvents.day, usageEvents.name],
        set: { count: sql`${usageEvents.count} + 1` },
      });
    // Old days leave with a sign-in: one cheap delete on the primary key.
    if (name === "login") {
      await db.delete(usageEvents).where(sql`${usageEvents.day} < (now() at time zone 'UTC')::date - ${USAGE_RETENTION_DAYS}::int`);
    }
  } catch (e) {
    reportError("usage", e);
  }
}

export type UsageTotals = { name: UsageEvent; total: number }[];

/** Totals per event over the last `days` days, the biggest first; [] when the table is missing. */
export async function getUsageTotals(days: number): Promise<UsageTotals> {
  try {
    const rows = await getDb()
      .select({ name: usageEvents.name, total: sql<number>`sum(${usageEvents.count})::int` })
      .from(usageEvents)
      .where(and(gte(usageEvents.day, sql`(now() at time zone 'UTC')::date - ${days}::int`)))
      .groupBy(usageEvents.name)
      .orderBy(desc(sql`sum(${usageEvents.count})`));
    return rows.filter((r): r is { name: UsageEvent; total: number } => isUsageEvent(r.name));
  } catch (e) {
    reportError("usage totals", e);
    return [];
  }
}

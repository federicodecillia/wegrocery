// Opening a planned cycle ("In programma", drizzle/0048_planned_cycles.sql):
// by hand with "Apri gli ordini" (adminOpenPlannedCycle), or by itself at the
// planned time (app/api/cron/open-cycles, every minute on Vercel). One write,
// guarded on the status, so the two can never open a cycle twice nor send
// its notices twice.
//
// The minute check must not wake the database: on Neon's free plan a query
// every minute would keep the compute on all month. So the time of the next
// automatic opening is cached (nextPlannedOpening, Next's data cache, tag
// PLANNED_OPENINGS_TAG) and every write that can move it drops the cache
// (invalidatePlannedOpenings). The database is read only when an opening is
// due, after such a write, or every few hours as a safety net (a nightly
// demo reset writes cycles without going through the app).

import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import { auditLog, members, orderCycles } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatDeadline } from "@/lib/i18n/deadline";
import { dispatchToMembers } from "@/lib/notifications/dispatch";
import { sendOpenAlerts } from "@/lib/notifications/open-alerts";
import { selectCycleAccessMembers } from "@/lib/notifications/reminder";

type Db = ReturnType<typeof getDb>;

export const PLANNED_OPENINGS_TAG = "planned-openings";
/** Who signs the audit row of an automatic opening. */
export const AUTO_OPEN_ACTOR = "system:auto-open";
/** The safety net: the cached next opening is read again at least this often. */
const CACHE_SECONDS = 6 * 60 * 60;

/**
 * Tells the members who can see a cycle that its orders are open: at the
 * creation of an open cycle and when a planned one opens, the two emit points
 * of cycle_opened. Kept apart from the write: a delivery failure must not
 * report the (already committed) cycle as failed.
 */
export async function notifyCycleOpened(
  db: Db,
  cycle: { title: string; accessLevel: string; orderCloseAt: Date | null },
  now: Date,
): Promise<void> {
  try {
    const allMembers = await db
      .select({
        memberId: members.memberId,
        email: members.email,
        role: members.role,
        active: members.active,
      })
      .from(members)
      // A person in a family sees the account's notifications: one each.
      .where(isNull(members.householdOf));
    const recipients = selectCycleAccessMembers(allMembers, cycle.accessLevel);
    await dispatchToMembers(
      db,
      recipients.map((m) => ({ memberId: m.memberId, email: m.email })),
      {
        type: "cycle_opened",
        title: t.notificationsServer.cycleOpenedTitle,
        body: t.notificationsServer.cycleOpenedBody(cycle.title, cycle.orderCloseAt ? formatDeadline(cycle.orderCloseAt) : ""),
        href: "/ordine",
      },
      now,
    );
  } catch (notifyError) {
    console.error("[cycle_opened] dispatch failed:", notifyError);
  }
}

/** Why a planned cycle did not open. */
export type OpenRefusal = "not_found" | "not_planned" | "close_in_past" | "not_due";

/**
 * Opens one planned cycle and tells the members (cycle_opened, then the
 * "Avvisami quando apre" emails). By hand it opens now and its dates stop
 * being indicative; automatically it opens only once its planned time has
 * come and only when its dates are not indicative, and keeps that time as
 * its opening. A pickup that was only indicative stays "da confermare".
 */
export async function openPlannedCycle(
  db: Db,
  cycleId: string,
  { actor, now, auto }: { actor: string; now: Date; auto: boolean },
): Promise<{ opened: true; alertsEmailed: number } | { error: OpenRefusal }> {
  const [opened] = await db
    .update(orderCycles)
    // The right side of pickupTentative reads the row before the update.
    .set({
      status: "open",
      ...(!auto && { orderOpenAt: now }),
      datesTentative: false,
      pickupTentative: sql`${orderCycles.pickupTentative} OR ${orderCycles.datesTentative}`,
    })
    .where(
      and(
        eq(orderCycles.cycleId, cycleId),
        eq(orderCycles.status, "planned"),
        or(isNull(orderCycles.orderCloseAt), sql`${orderCycles.orderCloseAt} > now()`),
        auto ? and(eq(orderCycles.datesTentative, false), lte(orderCycles.orderOpenAt, now)) : undefined,
      ),
    )
    .returning({ title: orderCycles.title, accessLevel: orderCycles.accessLevel, orderCloseAt: orderCycles.orderCloseAt, orderOpenAt: orderCycles.orderOpenAt });
  if (!opened) {
    const [current] = await db.select({ status: orderCycles.status }).from(orderCycles).where(eq(orderCycles.cycleId, cycleId)).limit(1);
    if (!current) return { error: "not_found" };
    if (current.status !== "planned") return { error: "not_planned" };
    return { error: auto ? "not_due" : "close_in_past" };
  }
  await notifyCycleOpened(db, opened, now);
  const alertsEmailed = await sendOpenAlerts(db, { cycleId, title: opened.title, orderCloseAt: opened.orderCloseAt });
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: actor,
    action: auto ? "auto_open_planned_cycle" : "open_planned_cycle",
    entityType: "cycle",
    entityId: cycleId,
    payloadJson: JSON.stringify({ openedAt: (opened.orderOpenAt ?? now).toISOString(), alertsEmailed }),
    createdAt: new Date(),
  });
  return { opened: true, alertsEmailed };
}

/** The planned cycles that open by themselves: dates not indicative, deadline still ahead. */
const autoOpenable = and(
  eq(orderCycles.status, "planned"),
  eq(orderCycles.datesTentative, false),
  or(isNull(orderCycles.orderCloseAt), sql`${orderCycles.orderCloseAt} > now()`),
);

/** Opens every planned cycle whose time has come. Returns the ids opened. */
export async function openDuePlannedCycles(db: Db, now: Date): Promise<string[]> {
  const due = await db
    .select({ cycleId: orderCycles.cycleId })
    .from(orderCycles)
    .where(and(autoOpenable, lte(orderCycles.orderOpenAt, now)))
    .orderBy(asc(orderCycles.orderOpenAt));
  const opened: string[] = [];
  for (const { cycleId } of due) {
    const result = await openPlannedCycle(db, cycleId, { actor: AUTO_OPEN_ACTOR, now, auto: true });
    if ("opened" in result) opened.push(cycleId);
  }
  return opened;
}

/** The earliest automatic opening still to come, read from the database. */
export async function readNextPlannedOpening(db: Db): Promise<Date | null> {
  const [row] = await db
    .select({ at: orderCycles.orderOpenAt })
    .from(orderCycles)
    .where(autoOpenable)
    .orderBy(asc(orderCycles.orderOpenAt))
    .limit(1);
  return row?.at ?? null;
}

/** The same, from the data cache: an ISO time or null (no automatic opening planned). */
export const nextPlannedOpening = unstable_cache(
  async (): Promise<string | null> => (await readNextPlannedOpening(getDb()))?.toISOString() ?? null,
  ["next-planned-opening"],
  { tags: [PLANNED_OPENINGS_TAG], revalidate: CACHE_SECONDS },
);

/** After any write that can move the next automatic opening: the next check reads the database. */
export function invalidatePlannedOpenings(): void {
  revalidateTag(PLANNED_OPENINGS_TAG, { expire: 0 });
}

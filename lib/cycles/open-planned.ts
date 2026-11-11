// Opening a planned cycle ("In programma", drizzle/0048_planned_cycles.sql):
// by hand with "Apri gli ordini" (adminOpenPlannedCycle), or by itself on its
// planned day (app/api/cron/open-cycles, once a day early in the morning on
// Vercel). A planned opening is a day, stored as 00:00 in the group's time
// zone. One write, guarded on the status, so the two can never open a cycle
// twice nor send its notices twice.

import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { dayOf } from "@/lib/calendar";
import type { getDb } from "@/lib/db/client";
import { auditLog, members, orderCycles } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatDeadline } from "@/lib/i18n/deadline";
import { zonedLocalToUtc } from "@/lib/i18n/zoned-time";
import { dispatchToMembers } from "@/lib/notifications/dispatch";
import { sendOpenAlerts } from "@/lib/notifications/open-alerts";
import { selectCycleAccessMembers } from "@/lib/notifications/reminder";

type Db = ReturnType<typeof getDb>;

/** Who signs the audit row of an automatic opening. */
export const AUTO_OPEN_ACTOR = "system:auto-open";

/** 00:00 of the day after `now`'s day, in the group's time zone: a planned day before it has come. */
export function endOfDay(now: Date): Date {
  const [y, m, d] = dayOf(now).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return zonedLocalToUtc(`${next}T00:00`)!;
}

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
 * being indicative; automatically it opens only once its planned day has
 * come and only when its dates are not indicative, and keeps that day as its
 * opening. A pickup that was only indicative stays "da confermare".
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
        auto ? and(eq(orderCycles.datesTentative, false), lt(orderCycles.orderOpenAt, endOfDay(now))) : undefined,
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

/** Opens every planned cycle whose day has come. Returns the ids opened. */
export async function openDuePlannedCycles(db: Db, now: Date): Promise<string[]> {
  const due = await db
    .select({ cycleId: orderCycles.cycleId })
    .from(orderCycles)
    .where(and(autoOpenable, lt(orderCycles.orderOpenAt, endOfDay(now))))
    .orderBy(asc(orderCycles.orderOpenAt));
  const opened: string[] = [];
  for (const { cycleId } of due) {
    const result = await openPlannedCycle(db, cycleId, { actor: AUTO_OPEN_ACTOR, now, auto: true });
    if ("opened" in result) opened.push(cycleId);
  }
  return opened;
}

"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCycleManager } from "@/lib/auth/manager";
import { ActionError, actionErrorMessage } from "@/lib/action-error";
import { getDb } from "@/lib/db/client";
import { auditLog, cyclePickups, members, orderCycles, orders } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { pickupRefusal, readPickupForm, type PickupForm } from "@/lib/pickups";

// Admin → Ciclo → Ritiri: mark who collected their order, when, with an
// optional note (lib/pickups.ts, drizzle/0046_cycle_pickups.sql). Only on a
// closed cycle, only for a member with an order on it.

type Db = ReturnType<typeof getDb>;
type Target = { cycleId: string; memberId: string };

/** The cycle, refused unless closed, and the member, refused unless they ordered on it. */
async function checkTarget(db: Db, { cycleId, memberId }: Target) {
  const [cycle] = await db
    .select({ title: orderCycles.title, status: orderCycles.status })
    .from(orderCycles)
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle) throw new ActionError(t.errors.cycleNotFound);
  const refusal = pickupRefusal(cycle.status);
  if (refusal) throw new ActionError(refusal);
  const [member] = await db
    .select({ email: members.email, active: members.active })
    .from(orders)
    .innerJoin(members, eq(members.memberId, orders.memberId))
    .where(and(eq(orders.cycleId, cycleId), eq(orders.memberId, memberId)))
    .limit(1);
  if (!member) throw new ActionError(t.admin.pickups.errors.noOrder);
  return { cycle, member };
}

/**
 * Marks the member's order as collected, or saves the changes to a pickup
 * already marked. With no time the pickup is now. The first mark tells the
 * member (category "Ordine ritirato", off unless they turned it on).
 */
export async function adminMarkPickup(input: Target & PickupForm): Promise<{ error?: string }> {
  try {
    const admin = await requireCycleManager(input.cycleId);
    const db = getDb();
    const now = new Date();
    const values = readPickupForm(input, now);
    if ("error" in values) throw new ActionError(values.error);
    const { cycle, member } = await checkTarget(db, input);

    const [row] = await db
      .insert(cyclePickups)
      .values({ cycleId: input.cycleId, memberId: input.memberId, ...values, recordedBy: admin.email, recordedAt: now })
      .onConflictDoUpdate({
        target: [cyclePickups.cycleId, cyclePickups.memberId],
        set: { ...values, recordedBy: admin.email, recordedAt: now },
      })
      // xmax is 0 on a row this statement inserted, not on one it updated.
      .returning({ created: sql<boolean>`(xmax = 0)` });
    await db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: admin.email,
      action: row?.created ? "pickup_marked" : "pickup_updated",
      entityType: "cycle",
      entityId: input.cycleId,
      payloadJson: JSON.stringify({ memberId: input.memberId, pickedUpAt: values.pickedUpAt.toISOString(), collectedBy: values.collectedBy, note: values.note }),
      createdAt: now,
    });

    if (row?.created && member.active) {
      const n = t.notificationsServer;
      try {
        await dispatchNotification(db, {
          memberId: input.memberId,
          memberEmail: member.email,
          type: "order_picked_up",
          title: n.pickedUpTitle(cycle.title),
          body: n.pickedUpBody(cycle.title, formatDateTime(values.pickedUpAt), values.collectedBy),
          href: `/storico?cycleId=${input.cycleId}`,
          createdAt: now,
        });
      } catch (notifyError) {
        console.error("[order_picked_up] dispatch failed:", notifyError);
      }
    }
    revalidate();
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminMarkPickup") };
  }
}

/** Takes the mark off: the order reads "to collect" again. No message to the member. */
export async function adminClearPickup(input: Target): Promise<{ error?: string }> {
  try {
    const admin = await requireCycleManager(input.cycleId);
    const db = getDb();
    await checkTarget(db, input);
    const removed = await db
      .delete(cyclePickups)
      .where(and(eq(cyclePickups.cycleId, input.cycleId), eq(cyclePickups.memberId, input.memberId)))
      .returning({ pickedUpAt: cyclePickups.pickedUpAt, collectedBy: cyclePickups.collectedBy, note: cyclePickups.note });
    if (removed.length > 0) {
      await db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "pickup_cleared",
        entityType: "cycle",
        entityId: input.cycleId,
        payloadJson: JSON.stringify({ memberId: input.memberId, was: removed[0] }),
        createdAt: new Date(),
      });
    }
    revalidate();
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminClearPickup") };
  }
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/storico");
  revalidatePath("/notifiche");
}

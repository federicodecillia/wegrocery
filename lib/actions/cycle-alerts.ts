"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ActionError, actionErrorMessage } from "@/lib/action-error";
import { requireUserSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { cycleOpenAlerts, orderCycles } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { canAccessCycle } from "@/lib/roles";

/**
 * "Avvisami quando apre" on a planned cycle the person can see: `on` asks for
 * the email (drizzle/0049_cycle_open_alerts.sql), off takes the request back.
 * The person who signed in, so in a family each is told at their own address.
 */
export async function setCycleOpenAlert(cycleId: string, on: boolean): Promise<{ error?: string }> {
  try {
    const session = await requireUserSession();
    const personId = session.user.personId ?? session.user.memberId;
    if (!personId) throw new ActionError(t.errors.unauthorized);
    const db = getDb();
    if (on) {
      const [cycle] = await db
        .select({ status: orderCycles.status, accessLevel: orderCycles.accessLevel })
        .from(orderCycles)
        .where(eq(orderCycles.cycleId, cycleId))
        .limit(1);
      if (!cycle || !canAccessCycle(cycle.accessLevel, session.user.role)) throw new ActionError(t.errors.cycleNotFound);
      if (cycle.status !== "planned") throw new ActionError(t.errors.alertNotPlanned);
      await db.insert(cycleOpenAlerts).values({ cycleId, memberId: personId }).onConflictDoNothing();
    } else {
      await db.delete(cycleOpenAlerts).where(and(eq(cycleOpenAlerts.cycleId, cycleId), eq(cycleOpenAlerts.memberId, personId)));
    }
    revalidatePath("/calendario");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "setCycleOpenAlert") };
  }
}

"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUserSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { notificationOwners } from "@/lib/db/queries";
import { notificationPreferences, notifications } from "@/lib/db/schema";
import { isNotificationCategory } from "@/lib/notifications/categories";
import { t } from "@/lib/i18n";
import { actionErrorMessage } from "@/lib/action-error";

export async function markNotificationRead(notificationId: string) {
  const session = await requireUserSession();
  const memberId = session.user.memberId;
  if (!memberId) return;
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.notificationId, notificationId),
        inArray(notifications.memberId, notificationOwners(memberId, session.user.personId)),
      ),
    );
  revalidatePath("/notifiche");
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const session = await requireUserSession();
  const memberId = session.user.memberId;
  if (!memberId) return;
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(inArray(notifications.memberId, notificationOwners(memberId, session.user.personId)), isNull(notifications.readAt)),
    );
  revalidatePath("/notifiche");
  revalidatePath("/");
}

// Upserts one category's channel preferences for the current member. Absent
// rows fall back to the code defaults, so writing a row here just overrides
// them; toggling everything back to default would leave a redundant row, which
// is harmless (resolvePreferences reads it as the same values).
export async function updateNotificationPreference(input: {
  category: string;
  appEnabled: boolean;
  emailEnabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireUserSession();
    const memberId = session.user.memberId;
    if (!memberId) return { error: t.errors.unauthorized };
    if (!isNotificationCategory(input.category)) return { error: t.errors.genericError };

    const db = getDb();
    const now = new Date();
    await db
      .insert(notificationPreferences)
      .values({
        memberId,
        category: input.category,
        appEnabled: input.appEnabled,
        emailEnabled: input.emailEnabled,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.memberId, notificationPreferences.category],
        set: { appEnabled: input.appEnabled, emailEnabled: input.emailEnabled, updatedAt: now },
      });

    revalidatePath("/profilo", "layout");
    return { ok: true };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "updateNotificationPreference") };
  }
}

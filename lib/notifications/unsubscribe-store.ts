import { getDb } from "@/lib/db/client";
import { notificationPreferences } from "@/lib/db/schema";
import { CATEGORY_DEFAULTS, type NotificationCategory } from "./categories";
import { getResolvedPreferences } from "./dispatch";

type Db = ReturnType<typeof getDb>;

/**
 * Turns off the email channel of one category for one member and keeps their
 * app channel as it is (a saved choice, or the default). Safe to repeat.
 */
export async function disableEmailForCategory(db: Db, memberId: string, category: NotificationCategory): Promise<void> {
  const resolved = (await getResolvedPreferences(db, [memberId])).get(memberId);
  const appEnabled = resolved?.[category]?.app ?? CATEGORY_DEFAULTS[category].app;
  const now = new Date();
  await db
    .insert(notificationPreferences)
    .values({ memberId, category, appEnabled, emailEnabled: false, updatedAt: now })
    .onConflictDoUpdate({
      target: [notificationPreferences.memberId, notificationPreferences.category],
      set: { emailEnabled: false, updatedAt: now },
    });
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireActiveMember } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { auditLog, members } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { cleanName, NAME_MAX_LENGTH } from "@/lib/profile/summary";

// The Profile page (app/profilo): a member renames themselves. The person who
// signed in, never the family account they work on. Addresses stay with the
// admin: they are sign-in keys.
export async function updateMyName(input: string): Promise<{ error?: string; message?: string }> {
  try {
    const session = await requireActiveMember();
    const name = cleanName(input);
    if (!name) return { error: t.profile.nameInvalid(NAME_MAX_LENGTH) };

    const db = getDb();
    const now = new Date();
    const [before] = await db
      .select({ fullName: members.fullName })
      .from(members)
      .where(eq(members.memberId, session.personId))
      .limit(1);
    if (!before) return { error: t.errors.unauthorized };
    if (before.fullName === name) return { message: t.profile.nameSaved };

    await db.batch([
      db.update(members).set({ fullName: name, updatedAt: now }).where(eq(members.memberId, session.personId)),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: session.email,
        action: "update_own_name",
        entityType: "member",
        entityId: session.personId,
        payloadJson: JSON.stringify({ from: before.fullName, to: name }),
        createdAt: now,
      }),
    ]);

    revalidatePath("/", "layout");
    return { message: t.profile.nameSaved };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "updateMyName") };
  }
}

// The welcome card on Home: the person closed it ("Ho capito" or "Salta").
// Personal, like the name. Kept the first time only, so reopening it from
// the guide and closing it again changes nothing.
export async function dismissWelcome(): Promise<{ error?: string }> {
  try {
    const session = await requireActiveMember();
    const db = getDb();
    await db
      .update(members)
      .set({ welcomeDismissedAt: new Date() })
      .where(and(eq(members.memberId, session.personId), isNull(members.welcomeDismissedAt)));
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "dismissWelcome") };
  }
}

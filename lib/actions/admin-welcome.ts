"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { t } from "@/lib/i18n";

// The welcome card at the top of Admin: the admin closed it ("Ho capito" or
// "Salta"). Personal (requireAdmin returns the admin's own row). Kept the
// first time only, so reopening it from the admin guide changes nothing.
export async function dismissAdminWelcome(): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    await getDb()
      .update(members)
      .set({ adminWelcomeDismissedAt: new Date() })
      .where(and(eq(members.memberId, session.memberId), isNull(members.adminWelcomeDismissedAt)));
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "dismissAdminWelcome") };
  }
}

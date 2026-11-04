// "Avvisami quando apre" (drizzle/0049_cycle_open_alerts.sql): the email to
// the people who asked, when a planned cycle's orders open. A plain server
// module, called by adminOpenPlannedCycle after the usual cycle_opened notice.
// Never throws: a failed email must not report the opening as failed.

import { eq } from "drizzle-orm";
import { getBrand } from "@/lib/brand/get-brand";
import { getDb } from "@/lib/db/client";
import { cycleOpenAlerts, members } from "@/lib/db/schema";
import { emailIdempotencyKey } from "@/lib/email/idempotency";
import { sendMailBatch } from "@/lib/email/resend";
import { notificationEmail } from "@/lib/email/templates";
import { t } from "@/lib/i18n";
import { formatDeadline } from "@/lib/i18n/deadline";
import { channelsForType } from "./categories";
import { getResolvedPreferences } from "./dispatch";

type Db = ReturnType<typeof getDb>;

/**
 * Emails everyone who asked to be told about this cycle, except those who get
 * the cycle_opened email anyway (their own preference), then forgets the
 * requests. Returns how many emails went out.
 */
export async function sendOpenAlerts(
  db: Db,
  cycle: { cycleId: string; title: string; orderCloseAt: Date | null },
): Promise<number> {
  try {
    const rows = await db
      .select({ memberId: members.memberId, email: members.email, active: members.active })
      .from(cycleOpenAlerts)
      .innerJoin(members, eq(members.memberId, cycleOpenAlerts.memberId))
      .where(eq(cycleOpenAlerts.cycleId, cycle.cycleId));
    const targets = rows.filter((r) => r.active && r.email);
    const prefs = await getResolvedPreferences(db, targets.map((r) => r.memberId));
    const toEmail = targets.filter((r) => !channelsForType("cycle_opened", prefs.get(r.memberId)!).email);
    if (toEmail.length > 0) {
      const n = t.notificationsServer;
      const { subject, text } = notificationEmail(
        {
          title: n.openAlertTitle(cycle.title),
          body: n.openAlertBody(cycle.title, cycle.orderCloseAt ? formatDeadline(cycle.orderCloseAt) : ""),
          href: "/ordine",
        },
        await getBrand(),
      );
      const result = await sendMailBatch(
        toEmail.map((r) => ({ to: r.email, subject, text })),
        undefined,
        emailIdempotencyKey("open_alert", cycle.cycleId),
      );
      if ("error" in result) console.error("[open_alert] email send failed:", result.error);
    }
    await db.delete(cycleOpenAlerts).where(eq(cycleOpenAlerts.cycleId, cycle.cycleId));
    return toEmail.length;
  } catch (e) {
    console.error("[open_alert] failed:", e);
    return 0;
  }
}

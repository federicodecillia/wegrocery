import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, orderCycles, orders } from "@/lib/db/schema";
import { dispatchToMembers } from "@/lib/notifications/dispatch";
import { REMINDER_WINDOW_MS, selectReminderTargets } from "@/lib/notifications/reminder";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";

// Invoked by the GitHub Actions cron (see .github/workflows/cycle-reminders.yml).
// Sends the "closing soon" reminder for open cycles that close within the
// window and haven't been reminded yet. Idempotent: a per-cycle compare-and-swap
// on closing_reminder_sent_at means overlapping/repeat runs send nothing extra.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  // Open cycles closing within the window that still need a reminder. The
  // predicate is self-healing: a cycle skipped by a late run stays eligible
  // until it closes, so the reminder can still go out (just closer to close).
  const dueCycles = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      accessLevel: orderCycles.accessLevel,
      orderCloseAt: orderCycles.orderCloseAt,
    })
    .from(orderCycles)
    .where(
      and(
        eq(orderCycles.status, "open"),
        gt(orderCycles.orderCloseAt, now),
        lte(orderCycles.orderCloseAt, windowEnd),
        isNull(orderCycles.closingReminderSentAt),
      ),
    );

  let remindersSent = 0;

  for (const cycle of dueCycles) {
    // Claim the cycle: only the run that flips sent_at from NULL proceeds. A
    // concurrent run gets 0 rows and skips, so no double-send.
    const claimed = await db
      .update(orderCycles)
      .set({ closingReminderSentAt: now })
      .where(
        and(eq(orderCycles.cycleId, cycle.cycleId), isNull(orderCycles.closingReminderSentAt)),
      )
      .returning({ cycleId: orderCycles.cycleId });
    if (claimed.length === 0) continue;

    const [allMembers, orderedRows] = await Promise.all([
      db
        .select({
          memberId: members.memberId,
          email: members.email,
          role: members.role,
          active: members.active,
        })
        .from(members),
      db.selectDistinct({ memberId: orders.memberId }).from(orders).where(eq(orders.cycleId, cycle.cycleId)),
    ]);
    const orderedIds = new Set(orderedRows.map((o) => o.memberId));
    const targets = selectReminderTargets(allMembers, cycle.accessLevel, orderedIds);
    if (targets.length === 0) continue;

    await dispatchToMembers(
      db,
      targets.map((m) => ({ memberId: m.memberId, email: m.email })),
      {
        type: "cycle_closing_reminder",
        title: t.notificationsServer.cycleClosingReminderTitle,
        body: t.notificationsServer.cycleClosingReminderBody(
          cycle.title,
          formatDateTime(cycle.orderCloseAt ?? now),
        ),
        href: "/ordine",
      },
      now,
    );
    remindersSent += targets.length;
  }

  return Response.json({ ok: true, cyclesChecked: dueCycles.length, remindersSent });
}

import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { getFamilyMemberIds } from "@/lib/db/queries";
import { orderCycles, orders, suppliers } from "@/lib/db/schema";
import { getAppBaseUrl } from "@/lib/email/base-url";
import { t } from "@/lib/i18n";
import { buildCycleIcs } from "@/lib/calendar-ics";
import { icsFileName, icsHeaders } from "@/lib/ics";
import { canAccessCycle } from "@/lib/roles";

// "Aggiungi al calendario" (/calendario): one cycle's dates as an .ics file
// (lib/calendar-ics.ts on the kit module lib/ics.ts) the phone opens in its calendar. Signed-in members only, for a
// cycle they can see or ordered on; anything else is a plain 404.

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ cycleId: string }> }) {
  const session = await auth();
  const memberId = session?.user?.memberId;
  if (!session?.user?.email || !memberId || session.user.active === false) return notFound();
  const { cycleId } = await params;

  const db = getDb();
  const [cycle] = await db
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      status: orderCycles.status,
      accessLevel: orderCycles.accessLevel,
      orderOpenAt: orderCycles.orderOpenAt,
      orderCloseAt: orderCycles.orderCloseAt,
      pickupDate: orderCycles.pickupDate,
      pickupEndTime: orderCycles.pickupEndTime,
      pickup2Date: orderCycles.pickup2Date,
      pickup2EndTime: orderCycles.pickup2EndTime,
      supplierName: suppliers.name,
    })
    .from(orderCycles)
    .leftJoin(suppliers, eq(suppliers.supplierId, orderCycles.supplierId))
    .where(eq(orderCycles.cycleId, cycleId))
    .limit(1);
  if (!cycle || cycle.status === "cancelled") return notFound();
  if (!canAccessCycle(cycle.accessLevel, session.user.role)) {
    const ids = await getFamilyMemberIds(memberId);
    const [ordered] = await db
      .select({ id: orders.orderLineId })
      .from(orders)
      .where(and(eq(orders.cycleId, cycleId), inArray(orders.memberId, ids)))
      .limit(1);
    if (!ordered) return notFound();
  }

  const base = getAppBaseUrl();
  const ics = buildCycleIcs(
    {
      cycleId: cycle.cycleId,
      title: cycle.title,
      supplierName: cycle.supplierName,
      opensAt: cycle.status === "planned" && cycle.orderOpenAt ? new Date(cycle.orderOpenAt) : null,
      // A closed cycle's deadline is behind it: only its pickups are worth a calendar.
      closeAt: cycle.status === "closed" || !cycle.orderCloseAt ? null : new Date(cycle.orderCloseAt),
      pickups: [
        cycle.pickupDate && { at: new Date(cycle.pickupDate), endTime: cycle.pickupEndTime },
        cycle.pickup2Date && { at: new Date(cycle.pickup2Date), endTime: cycle.pickup2EndTime },
      ].filter((p): p is { at: Date; endTime: string | null } => Boolean(p)),
      url: base ? `${base}/calendario` : null,
    },
    t.calendar.ics,
    new Date(),
  );
  return new Response(ics, { headers: icsHeaders(icsFileName(cycle.title, "ordine")) });
}

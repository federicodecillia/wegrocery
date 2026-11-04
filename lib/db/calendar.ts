import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { CALENDAR_PAST_DAYS, type CalendarCycleRow } from "@/lib/calendar";
import { canAccessCycle } from "@/lib/roles";
import { getDb } from "./client";
import { cyclePickups, orderCycles, orders, products, suppliers } from "./schema";

// Reads of the order calendar (/calendario, lib/calendar.ts).

/**
 * The open and closed cycles of the last CALENDAR_PAST_DAYS a member can see
 * (canAccessCycle for their role, or any cycle their account ordered on),
 * with whether they ordered and collected. `memberIds`: the account and the
 * people of its family, as in Storico.
 */
export async function getCalendarCycles(role: string | null, memberIds: string[]): Promise<CalendarCycleRow[]> {
  const ids = memberIds.length > 0 ? memberIds : ["-"];
  const since = sql`now() - make_interval(days => ${CALENDAR_PAST_DAYS})`;
  const rows = await getDb()
    .select({
      cycleId: orderCycles.cycleId,
      title: orderCycles.title,
      supplierName: suppliers.name,
      status: orderCycles.status,
      accessLevel: orderCycles.accessLevel,
      orderOpenAt: orderCycles.orderOpenAt,
      orderCloseAt: orderCycles.orderCloseAt,
      createdAt: orderCycles.createdAt,
      pickupDate: orderCycles.pickupDate,
      pickupEndTime: orderCycles.pickupEndTime,
      pickup2Date: orderCycles.pickup2Date,
      pickup2EndTime: orderCycles.pickup2EndTime,
      productCount: sql<number>`(SELECT count(*)::int FROM ${products} WHERE ${products.cycleId} = ${orderCycles.cycleId})`,
      hasOrder: sql<boolean>`EXISTS (
        SELECT 1 FROM ${orders}
        WHERE ${orders.cycleId} = ${orderCycles.cycleId} AND ${inArray(orders.memberId, ids)}
      )`,
      pickedUp: sql<boolean>`EXISTS (
        SELECT 1 FROM ${cyclePickups}
        WHERE ${cyclePickups.cycleId} = ${orderCycles.cycleId} AND ${inArray(cyclePickups.memberId, ids)}
      )`,
    })
    .from(orderCycles)
    .leftJoin(suppliers, eq(orderCycles.supplierId, suppliers.supplierId))
    .where(
      and(
        inArray(orderCycles.status, ["open", "closed"]),
        sql`greatest(
          ${orderCycles.pickupDate}, ${orderCycles.pickup2Date},
          ${orderCycles.orderCloseAt}, coalesce(${orderCycles.orderOpenAt}, ${orderCycles.createdAt})
        ) >= ${since}`,
      ),
    )
    .orderBy(desc(orderCycles.createdAt));
  return rows
    .filter((r) => r.hasOrder || canAccessCycle(r.accessLevel, role))
    .map((r) => ({
      cycleId: r.cycleId,
      title: r.title,
      supplierName: r.supplierName,
      status: r.status,
      pickupEndTime: r.pickupEndTime,
      pickup2EndTime: r.pickup2EndTime,
      orderOpenAt: r.orderOpenAt ? new Date(r.orderOpenAt) : null,
      orderCloseAt: r.orderCloseAt ? new Date(r.orderCloseAt) : null,
      createdAt: new Date(r.createdAt),
      pickupDate: r.pickupDate ? new Date(r.pickupDate) : null,
      pickup2Date: r.pickup2Date ? new Date(r.pickup2Date) : null,
      productCount: Number(r.productCount),
      hasOrder: Boolean(r.hasOrder),
      pickedUp: Boolean(r.pickedUp),
    }));
}

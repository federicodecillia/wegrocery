import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./client";
import { cyclePickups, members, orders } from "./schema";

// Reads of the pickup register (drizzle/0046_cycle_pickups.sql); the writes
// are in lib/actions/admin-pickups.ts.

export type CyclePickupRow = {
  memberId: string;
  fullName: string;
  /** Order lines of the member on the cycle. */
  lines: number;
  /** ISO; null = not collected yet. */
  pickedUpAt: string | null;
  collectedBy: string | null;
  note: string | null;
  /** The name of whoever marked it, when the address is still a member's. */
  recordedByName: string | null;
};

/** Every member with an order on the cycle, by name, with their pickup if marked. */
export async function getCyclePickups(cycleId: string): Promise<CyclePickupRow[]> {
  const rows = await getDb()
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      lines: sql<number>`count(*)::int`,
      pickedUpAt: cyclePickups.pickedUpAt,
      collectedBy: cyclePickups.collectedBy,
      note: cyclePickups.note,
      recordedByName: sql<string | null>`(
        SELECT m.full_name FROM members m
        WHERE lower(m.email) = lower(${cyclePickups.recordedBy})
           OR lower(m.alias_email) = lower(${cyclePickups.recordedBy})
        LIMIT 1
      )`,
    })
    .from(orders)
    .innerJoin(members, eq(members.memberId, orders.memberId))
    .leftJoin(cyclePickups, and(eq(cyclePickups.cycleId, orders.cycleId), eq(cyclePickups.memberId, orders.memberId)))
    .where(eq(orders.cycleId, cycleId))
    .groupBy(
      members.memberId,
      members.fullName,
      cyclePickups.pickedUpAt,
      cyclePickups.collectedBy,
      cyclePickups.note,
      cyclePickups.recordedBy,
    )
    .orderBy(asc(members.fullName));
  return rows.map((r) => ({ ...r, pickedUpAt: r.pickedUpAt ? new Date(r.pickedUpAt).toISOString() : null }));
}

export type MemberPickup = { pickedUpAt: Date; collectedBy: string | null };

/** By cycle, when the members' orders were collected (Storico). The note stays with the admins. */
export async function getMemberPickups(memberIds: string[]): Promise<Map<string, MemberPickup>> {
  const out = new Map<string, MemberPickup>();
  if (memberIds.length === 0) return out;
  const rows = await getDb()
    .select({ cycleId: cyclePickups.cycleId, pickedUpAt: cyclePickups.pickedUpAt, collectedBy: cyclePickups.collectedBy })
    .from(cyclePickups)
    .where(inArray(cyclePickups.memberId, memberIds));
  for (const r of rows) {
    const prev = out.get(r.cycleId);
    // A family: the latest pickup of its people on the cycle.
    if (!prev || prev.pickedUpAt < r.pickedUpAt) out.set(r.cycleId, { pickedUpAt: r.pickedUpAt, collectedBy: r.collectedBy });
  }
  return out;
}

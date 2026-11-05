import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { getCalendarCycles } from "./calendar";

// The order calendar's read on a real database: which cycles a member sees,
// whether they ordered and collected, and how far back it reaches.
describeDb("order calendar", () => {
  const scope = makeScope("calendar");
  const { sql } = scope;
  const products = [{ name: "Mele", unitPrice: 2 }];
  const mine = <T extends { cycleId: string }>(rows: T[]) => rows.filter((r) => r.cycleId.startsWith(scope.prefix));

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("lists the open and closed cycles a member can see, with their orders and pickups", async () => {
    const open = await scope.createCycle("open", { products });
    const ordered = await scope.createCycle("ordered", { products });
    const hidden = await scope.createCycle("hidden", { products });
    const cancelled = await scope.createCycle("cancelled", { products });
    await sql`UPDATE order_cycles SET access_level = 'utenti' WHERE cycle_id IN (${open.cycleId}, ${ordered.cycleId}, ${cancelled.cycleId})`;
    await sql`UPDATE order_cycles SET status = 'cancelled' WHERE cycle_id = ${cancelled.cycleId}`;
    // An admin-only cycle the member ordered on stays visible to them.
    const adminOnly = await scope.createCycle("adminonly", { products });
    for (const c of [ordered, adminOnly]) {
      await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
          line_total, updated_at)
        VALUES (${`${c.cycleId}_line`}, ${c.cycleId}, ${scope.memberId}, ${c.productIds[0]}, 1, 2, 2, now())`;
    }
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now(), pickup_date = now() - interval '1 day'
      WHERE cycle_id = ${ordered.cycleId}`;
    await sql`INSERT INTO cycle_pickups (cycle_id, member_id, picked_up_at, recorded_by)
      VALUES (${ordered.cycleId}, ${scope.memberId}, now(), 'int-test')`;

    const rows = mine(await getCalendarCycles("utenti", [scope.memberId]));
    const byId = new Map(rows.map((r) => [r.cycleId, r]));
    expect([...byId.keys()].sort()).toEqual([adminOnly.cycleId, open.cycleId, ordered.cycleId].sort());
    expect(byId.has(hidden.cycleId)).toBe(false);
    expect(byId.get(open.cycleId)).toMatchObject({ status: "open", hasOrder: false, pickedUp: false, productCount: 1 });
    expect(byId.get(ordered.cycleId)).toMatchObject({ status: "closed", hasOrder: true, pickedUp: true });
    expect(byId.get(ordered.cycleId)?.pickupDate).toBeInstanceOf(Date);
    // An admin sees the admin-only cycles too.
    expect(mine(await getCalendarCycles("admin", ["-"])).map((r) => r.cycleId)).toContain(hidden.cycleId);
  });

  it("leaves out the cycles whose last date is over a year ago", async () => {
    const old = await scope.createCycle("old", { products });
    await sql`UPDATE order_cycles SET status = 'closed', access_level = 'utenti',
        created_at = now() - interval '400 days', order_open_at = now() - interval '400 days',
        order_close_at = now() - interval '395 days', pickup_date = now() - interval '390 days'
      WHERE cycle_id = ${old.cycleId}`;
    const rows = mine(await getCalendarCycles("utenti", [scope.memberId]));
    expect(rows.map((r) => r.cycleId)).not.toContain(old.cycleId);
  });
});

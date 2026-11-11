import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { AUTO_OPEN_ACTOR, endOfDay, openDuePlannedCycles, openPlannedCycle } from "@/lib/cycles/open-planned";
import { describeDb, makeScope } from "@/test/int/fixtures";

// Planned cycles opening by themselves (app/api/cron/open-cycles) and by hand
// ("Apri gli ordini"), on a real database: only cycles whose day has come,
// with firm dates, open by themselves, once, keeping their planned day.
describeDb("opening planned cycles", () => {
  const scope = makeScope("autoopen");
  const { sql } = scope;

  const planned = async (name: string, opensIn: string, { tentative = false, closesIn = "7 days" } = {}) => {
    const cycle = await scope.createCycle(name, { products: [{ name: "Riso", unitPrice: 3 }] });
    await sql`UPDATE order_cycles SET status = 'planned', access_level = 'utenti', dates_tentative = ${tentative},
        order_open_at = now() + ${opensIn}::interval, order_close_at = now() + ${closesIn}::interval
      WHERE cycle_id = ${cycle.cycleId}`;
    return cycle.cycleId;
  };
  const row = async (cycleId: string) =>
    (await sql`SELECT status, dates_tentative, order_open_at::text AS open_at, extract(epoch FROM order_open_at) * 1000 AS open_ms FROM order_cycles WHERE cycle_id = ${cycleId}`)[0];

  beforeAll(async () => {
    await scope.createMember();
  });
  afterAll(async () => {
    await scope.cleanup();
  });

  it("opens a cycle with firm dates once, on its planned day", async () => {
    const id = await planned("due", "-2 minutes");
    const before = await row(id);
    const opened = await openDuePlannedCycles(getDb(), new Date());
    expect(opened).toContain(id);
    const after = await row(id);
    expect(after.status).toBe("open");
    expect(after.open_at).toBe(before.open_at);
    const audit = await sql`SELECT user_email FROM audit_log WHERE entity_id = ${id} AND action = 'auto_open_planned_cycle'`;
    expect(audit).toEqual([{ user_email: AUTO_OPEN_ACTOR }]);
    expect(await openDuePlannedCycles(getDb(), new Date())).not.toContain(id);
  });

  it("leaves indicative dates, future openings and passed deadlines to the admin", async () => {
    const tentative = await planned("tentative", "-2 minutes", { tentative: true });
    const future = await planned("future", "2 days");
    const late = await planned("late", "-3 days", { closesIn: "-1 day" });
    const opened = await openDuePlannedCycles(getDb(), new Date());
    for (const id of [tentative, future, late]) {
      expect(opened).not.toContain(id);
      expect((await row(id)).status).toBe("planned");
    }
    expect(await openPlannedCycle(getDb(), future, { actor: AUTO_OPEN_ACTOR, now: new Date(), auto: true })).toEqual({ error: "not_due" });
  });

  it("opens on the planned day even before the planned time of an older cycle", () =>
    (async () => {
      const id = await planned("later-today", "1 day");
      // The last minute of today in the group's time zone.
      await sql`UPDATE order_cycles SET order_open_at = ${new Date(endOfDay(new Date()).getTime() - 60_000)} WHERE cycle_id = ${id}`;
      expect(await openDuePlannedCycles(getDb(), new Date())).toContain(id);
    })());

  it("opens by hand now, even with indicative dates", async () => {
    const id = await planned("manual", "2 days", { tentative: true });
    const now = new Date();
    expect(await openPlannedCycle(getDb(), id, { actor: "admin@example.org", now, auto: false })).toMatchObject({ opened: true });
    const after = await row(id);
    expect(after).toMatchObject({ status: "open", dates_tentative: false });
    expect(Math.round(Number(after.open_ms))).toBe(now.getTime());
    expect(await openPlannedCycle(getDb(), id, { actor: "admin@example.org", now, auto: false })).toEqual({ error: "not_planned" });
  });
});

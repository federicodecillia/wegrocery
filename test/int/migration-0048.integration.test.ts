import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setOpenCycleFee } from "@/lib/cycle-close-store";
import { getDb } from "@/lib/db/client";
import { getCalendarCycles, getNextPlannedCycle, getPlannedPreviews } from "@/lib/db/calendar";
import { saveCustomProductOrder } from "@/lib/db/cycle-product-order";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0048_planned_cycles.sql on a real database: the flag exists, a
// planned cycle keeps its terms editable (fee, product order) like an open
// one, the calendar reads it with its preview, the fee stays frozen once
// closed, and the rollback file undoes it.
describeDb("migration 0048 (planned cycles)", () => {
  const scope = makeScope("m0048");
  const { sql } = scope;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const apply = async () => {
    for (const statement of statements("drizzle/0048_planned_cycles.sql")) await runSql(statement);
  };
  const column = () => sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'order_cycles' AND column_name = 'dates_tentative'`;
  const products = [
    { name: "Zucca", unitPrice: 2 },
    { name: "Arance", unitPrice: 3 },
  ];

  const planned = async (name: string) => {
    const cycle = await scope.createCycle(name, { products, fee: { type: "percent", value: 5 } });
    await sql`UPDATE order_cycles SET status = 'planned', access_level = 'utenti', dates_tentative = true,
        order_open_at = now() + interval '2 days', order_close_at = now() + interval '9 days'
      WHERE cycle_id = ${cycle.cycleId}`;
    return cycle;
  };

  beforeAll(async () => {
    await scope.createMember();
    // Another file may have re-run 0026, which froze the fee outside 'open'.
    await apply();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors, not tentative by default", async () => {
    await apply();
    expect(await column()).toEqual([{ data_type: "boolean", is_nullable: "NO", column_default: "false" }]);
  });

  it("lets a planned cycle change its fee and its product order", async () => {
    const { cycleId, productIds } = await planned("terms");
    expect(await setOpenCycleFee(getDb(), cycleId, { type: "fixed", value: 1.5 })).toBe(true);
    expect(await saveCustomProductOrder(getDb(), cycleId, [...productIds].reverse())).toBe("saved");
    const [c] = await sql`SELECT handling_fee_type, handling_fee_value::text AS v, product_order FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c).toEqual({ handling_fee_type: "fixed", v: "1.50", product_order: "custom" });
  });

  it("still freezes the fee once the cycle is closed", async () => {
    const { cycleId } = await planned("frozen");
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    await expect(sql`UPDATE order_cycles SET handling_fee_value = 7 WHERE cycle_id = ${cycleId}`).rejects.toThrow(
      /cannot change once the cycle is closed/,
    );
    expect(await setOpenCycleFee(getDb(), cycleId, { type: "percent", value: 7 })).toBe(false);
  });

  it("shows a planned cycle in the calendar, with its preview, and as the next one on Home", async () => {
    const { cycleId } = await planned("calendar");
    const rows = (await getCalendarCycles("utenti", [scope.memberId])).filter((r) => r.cycleId === cycleId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "planned", datesTentative: true, hasOrder: false, productCount: 2 });
    const previews = await getPlannedPreviews([cycleId]);
    expect(previews.get(cycleId)?.map((p) => p.name)).toEqual(["Arance", "Zucca"]);
    const next = await getNextPlannedCycle("admin");
    expect(next).not.toBeNull();
    expect(next!.orderOpenAt).toBeInstanceOf(Date);
  });

  it("has a rollback that cancels planned cycles and drops the column", async () => {
    const { cycleId } = await planned("rollback");
    for (const statement of statements("drizzle/0048_planned_cycles_down.sql")) await runSql(statement);
    expect(await column()).toHaveLength(0);
    const [c] = await sql`SELECT status FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c.status).toBe("cancelled");
    await apply();
    expect(await column()).toHaveLength(1);
  });
});

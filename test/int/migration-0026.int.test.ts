import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0026_handling_charge.sql on a real database: it runs again on a
// migrated database, keeps one live charge of each kind per member and cycle,
// and freezes the fee once the cycle is closed.
describeDb("migration 0026 (order preparation fee)", () => {
  const scope = makeScope("m0026");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors", async () => {
    const statements = readFileSync("drizzle/0026_handling_charge.sql", "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBe(5);
    for (const statement of statements) await runSql(statement);
  });

  it("keeps one live order preparation fee per member and cycle", async () => {
    const { cycleId } = await scope.createCycle("dup");
    await scope.addLedger("h1", scope.memberId, "handling_charge", -1, cycleId);
    await expect(scope.addLedger("h2", scope.memberId, "handling_charge", -1, cycleId)).rejects.toThrow(
      /system_charge_live_uniq/,
    );
  });

  it("still keeps one live order charge per member and cycle", async () => {
    const { cycleId } = await scope.createCycle("dup_order");
    await scope.addLedger("o1", scope.memberId, "order_charge", -5, cycleId);
    await expect(scope.addLedger("o2", scope.memberId, "order_charge", -5, cycleId)).rejects.toThrow(
      /system_charge_live_uniq/,
    );
  });

  it("lets an open cycle change its fee", async () => {
    const { cycleId } = await scope.createCycle("open", { fee: { type: "percent", value: 5 } });
    await sql`UPDATE order_cycles SET handling_fee_value = 6 WHERE cycle_id = ${cycleId}`;
    const [c] = await sql`SELECT handling_fee_value::text AS v FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c.v).toBe("6.00");
  });

  it("refuses a fee change once the cycle is closed, and keeps every other edit", async () => {
    const { cycleId } = await scope.createCycle("frozen", { fee: { type: "percent", value: 5 } });
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    await expect(sql`UPDATE order_cycles SET handling_fee_value = 6 WHERE cycle_id = ${cycleId}`).rejects.toThrow(
      /cannot change once the cycle is closed/,
    );
    await expect(
      sql`UPDATE order_cycles SET handling_fee_type = NULL, handling_fee_value = NULL WHERE cycle_id = ${cycleId}`,
    ).rejects.toThrow(/cannot change once the cycle is closed/);
    await sql`UPDATE order_cycles SET title = 'renamed', handling_fee_value = 5 WHERE cycle_id = ${cycleId}`;
    await sql`UPDATE order_cycles SET status = 'cancelled' WHERE cycle_id = ${cycleId}`;
    const [c] = await sql`SELECT title, status, handling_fee_value::text AS v FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c).toEqual({ title: "renamed", status: "cancelled", v: "5.00" });
  });
});

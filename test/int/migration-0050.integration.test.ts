import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0050_pickup_tentative.sql on a real database: every cycle starts
// confirmed, the mark is stored per cycle, and the rollback file undoes it.
describeDb("migration 0050 (pickup tentative)", () => {
  const scope = makeScope("m0050");
  const { sql } = scope;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const column = () => sql`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_cycles' AND column_name = 'pickup_tentative'`;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors, every cycle confirmed", async () => {
    for (const statement of statements("drizzle/0050_pickup_tentative.sql")) await runSql(statement);
    expect((await column())[0].n).toBe(1);
    const { cycleId } = await scope.createCycle("default");
    const [row] = await sql`SELECT pickup_tentative FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(row.pickup_tentative).toBe(false);
  });

  it("keeps the mark per cycle", async () => {
    const { cycleId } = await scope.createCycle("tentative");
    await sql`UPDATE order_cycles SET pickup_tentative = true WHERE cycle_id = ${cycleId}`;
    const [row] = await sql`SELECT pickup_tentative FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(row.pickup_tentative).toBe(true);
  });

  it("has a rollback that drops the column", async () => {
    for (const statement of statements("drizzle/0050_pickup_tentative_down.sql")) await runSql(statement);
    expect((await column())[0].n).toBe(0);
    for (const statement of statements("drizzle/0050_pickup_tentative.sql")) await runSql(statement);
    expect((await column())[0].n).toBe(1);
  });
});

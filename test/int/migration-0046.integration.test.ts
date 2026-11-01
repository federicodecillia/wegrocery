import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0046_cycle_pickups.sql on a real database: the table exists with
// its key and limits, the migration runs again, and the rollback file undoes it.
describeDb("migration 0046 (cycle pickups)", () => {
  const { sql } = makeScope("m0046");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  const columns = () => sql`SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'cycle_pickups' ORDER BY column_name`;
  const constraints = async () =>
    (await sql`SELECT conname FROM pg_constraint WHERE conrelid = 'cycle_pickups'::regclass ORDER BY conname`).map(
      (r) => r.conname as string,
    );

  it("applies again without errors, one row per cycle and member, capped texts", async () => {
    for (const statement of statementsOf("drizzle/0046_cycle_pickups.sql")) await runSql(statement);
    expect(await columns()).toEqual([
      { column_name: "collected_by", is_nullable: "YES" },
      { column_name: "cycle_id", is_nullable: "NO" },
      { column_name: "member_id", is_nullable: "NO" },
      { column_name: "note", is_nullable: "YES" },
      { column_name: "picked_up_at", is_nullable: "NO" },
      { column_name: "recorded_at", is_nullable: "NO" },
      { column_name: "recorded_by", is_nullable: "NO" },
    ]);
    const names = await constraints();
    expect(names).toContain("cycle_pickups_pkey");
    expect(names).toContain("cycle_pickups_note_len");
    expect(names).toContain("cycle_pickups_collected_by_len");
  });

  it("has a rollback that drops the table", async () => {
    const down = readFileSync("drizzle/0046_cycle_pickups_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    expect(await columns()).toHaveLength(0);
    for (const statement of statementsOf("drizzle/0046_cycle_pickups.sql")) await runSql(statement);
    expect(await columns()).toHaveLength(7);
  });
});

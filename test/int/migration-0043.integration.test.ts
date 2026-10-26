import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0043_new_cycle_defaults.sql on a real database: both columns exist
// and are nullable, only the two modes pass the check, the migration runs
// again, and the rollback file undoes it.
describeDb("migration 0043 (new cycle defaults)", () => {
  const { sql } = makeScope("m0043");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  const columns = () => sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name IN ('new_cycle_payment_mode', 'new_cycle_defaults')
    ORDER BY column_name`;

  it("applies again without errors, both columns nullable", async () => {
    for (const statement of statementsOf("drizzle/0043_new_cycle_defaults.sql")) await runSql(statement);
    expect(await columns()).toEqual([
      { column_name: "new_cycle_defaults", data_type: "jsonb", is_nullable: "YES" },
      { column_name: "new_cycle_payment_mode", data_type: "text", is_nullable: "YES" },
    ]);
    const [check] = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'app_settings_new_cycle_payment_mode_check'`;
    expect(check?.def).toContain("per_order");
  });

  it("has a rollback that drops the columns, and they can come back", async () => {
    const down = readFileSync("drizzle/0043_new_cycle_defaults_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    expect(await columns()).toHaveLength(0);
    for (const statement of statementsOf("drizzle/0043_new_cycle_defaults.sql")) await runSql(statement);
    expect(await columns()).toHaveLength(2);
  });
});

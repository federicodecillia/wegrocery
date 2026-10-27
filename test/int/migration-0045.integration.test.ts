import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0045_weighing_deposit.sql on a real database: the column exists,
// empty by default, the check keeps it to card cycles and 0-25%, the
// migration runs again, and the rollback file undoes it.
describeDb("migration 0045 (weighing deposit)", () => {
  const { sql } = makeScope("m0045");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  const column = () => sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'order_cycles' AND column_name = 'weighing_deposit_pct'`;
  const check = async () => {
    const [row] = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'order_cycles_weighing_deposit_check'`;
    return row?.def as string | undefined;
  };

  it("applies again without errors, no deposit by default, card cycles only", async () => {
    for (const statement of statementsOf("drizzle/0045_weighing_deposit.sql")) await runSql(statement);
    expect(await column()).toEqual([{ data_type: "numeric", is_nullable: "YES", column_default: null }]);
    const def = await check();
    expect(def).toContain("per_order");
    expect(def).toContain("25");
  });

  it("has a rollback that drops the column and the check", async () => {
    const down = readFileSync("drizzle/0045_weighing_deposit_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    expect(await column()).toHaveLength(0);
    expect(await check()).toBeUndefined();
    for (const statement of statementsOf("drizzle/0045_weighing_deposit.sql")) await runSql(statement);
    expect(await column()).toHaveLength(1);
    expect(await check()).toBeDefined();
  });
});

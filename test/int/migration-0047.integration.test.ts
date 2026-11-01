import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0047_orders_referent.sql on a real database: the flag exists, off
// for everyone, the migration runs again, and the rollback file undoes it.
describeDb("migration 0047 (orders referent)", () => {
  const { sql } = makeScope("m0047");

  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

  const column = () => sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'orders_referent'`;

  it("applies again without errors, off by default", async () => {
    for (const statement of statements("drizzle/0047_orders_referent.sql")) await runSql(statement);
    expect(await column()).toEqual([{ data_type: "boolean", is_nullable: "NO", column_default: "false" }]);
  });

  it("has a rollback that drops the column", async () => {
    for (const statement of statements("drizzle/0047_orders_referent_down.sql")) await runSql(statement);
    expect(await column()).toHaveLength(0);
    for (const statement of statements("drizzle/0047_orders_referent.sql")) await runSql(statement);
    expect(await column()).toHaveLength(1);
  });
});

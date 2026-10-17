import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0038_card_cycles_switch.sql on a real database: the column exists,
// on by default (groups that never touch it keep Carta), the migration runs
// again, and the rollback file undoes it.
describeDb("migration 0038 (card cycles switch)", () => {
  const { sql } = makeScope("m0038");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

  it("applies again without errors, with the switch on by default", async () => {
    const statements = statementsOf("drizzle/0038_card_cycles_switch.sql");
    expect(statements).toHaveLength(1);
    for (const statement of statements) await runSql(statement);
    const [column] = await sql`SELECT column_default, is_nullable FROM information_schema.columns
      WHERE table_name = 'app_settings' AND column_name = 'card_cycles_enabled'`;
    expect(column).toMatchObject({ column_default: "true", is_nullable: "NO" });
  });

  it("has a rollback that drops the column, and the column can come back", async () => {
    const [down] = statementsOf("drizzle/0038_card_cycles_switch_down.sql");
    await runSql(down);
    const gone = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'card_cycles_enabled'`;
    expect(gone).toHaveLength(0);
    for (const statement of statementsOf("drizzle/0038_card_cycles_switch.sql")) await runSql(statement);
  });
});

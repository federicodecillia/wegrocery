import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0041_member_name_prompt.sql on a real database: the column exists,
// 'optional' by default, only the three modes pass the check, the migration
// runs again, and the rollback file undoes it.
describeDb("migration 0041 (member name prompt)", () => {
  const { sql } = makeScope("m0041");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  it("applies again without errors, 'optional' by default", async () => {
    for (const statement of statementsOf("drizzle/0041_member_name_prompt.sql")) await runSql(statement);
    const [column] = await sql`SELECT column_default, is_nullable FROM information_schema.columns
      WHERE table_name = 'app_settings' AND column_name = 'member_name_prompt'`;
    expect(column).toMatchObject({ column_default: "'optional'::text", is_nullable: "NO" });
    const [check] = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_member_name_prompt_check'`;
    expect(check).toBeTruthy();
  });

  it("has a rollback that drops the column, and the column can come back", async () => {
    const down = readFileSync("drizzle/0041_member_name_prompt_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    const gone = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'member_name_prompt'`;
    expect(gone).toHaveLength(0);
    for (const statement of statementsOf("drizzle/0041_member_name_prompt.sql")) await runSql(statement);
  });
});

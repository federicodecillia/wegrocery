import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0044_wallet_topups.sql on a real database: the switch exists and is
// on by default, the wallet channel check lets a wallet group without a
// channel through only with top-ups off, the migration runs again, and the
// rollback file undoes it.
describeDb("migration 0044 (wallet top-ups switch)", () => {
  const { sql } = makeScope("m0044");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  const column = () => sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'wallet_topups_enabled'`;
  const channelCheck = async () => {
    const [row] = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'app_settings_wallet_channel_check'`;
    return row?.def as string | undefined;
  };

  it("applies again without errors, the switch on by default", async () => {
    for (const statement of statementsOf("drizzle/0044_wallet_topups.sql")) await runSql(statement);
    expect(await column()).toEqual([{ data_type: "boolean", is_nullable: "NO", column_default: "true" }]);
    expect(await channelCheck()).toContain("wallet_topups_enabled");
  });

  it("has a rollback that restores the old check and drops the switch", async () => {
    const down = readFileSync("drizzle/0044_wallet_topups_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    expect(await column()).toHaveLength(0);
    expect(await channelCheck()).not.toContain("wallet_topups_enabled");
    for (const statement of statementsOf("drizzle/0044_wallet_topups.sql")) await runSql(statement);
    expect(await column()).toHaveLength(1);
    expect(await channelCheck()).toContain("wallet_topups_enabled");
  });
});

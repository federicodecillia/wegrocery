import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0042_card_settles_wallet.sql on a real database: the switch is off
// by default, payments get balance_cents, the counterpart check takes
// wallet_transfer pairs, the migration runs again, and the rollback file
// undoes it.
describeDb("migration 0042 (wallet in card payments)", () => {
  const { sql } = makeScope("m0042");

  const statementsOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") || l.includes("statement-breakpoint"))
      .join("\n")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

  const columnOf = async (table: string, column: string) =>
    (
      await sql`SELECT column_default, is_nullable FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${column}`
    )[0];

  it("applies again without errors, with the switch off and no balance part by default", async () => {
    for (const statement of statementsOf("drizzle/0042_card_settles_wallet.sql")) await runSql(statement);
    expect(await columnOf("app_settings", "card_settles_wallet")).toMatchObject({ column_default: "false", is_nullable: "NO" });
    expect(await columnOf("payments", "balance_cents")).toMatchObject({ column_default: "0", is_nullable: "NO" });
    const [check] = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'ledger_entries_counterpart_check'`;
    expect(check.def).toContain("wallet_transfer");
  });

  it("has a rollback that drops the columns, and they can come back", async () => {
    const down = readFileSync("drizzle/0042_card_settles_wallet_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of down) await runSql(statement);
    expect(await columnOf("app_settings", "card_settles_wallet")).toBeUndefined();
    expect(await columnOf("payments", "balance_cents")).toBeUndefined();
    for (const statement of statementsOf("drizzle/0042_card_settles_wallet.sql")) await runSql(statement);
    expect(await columnOf("payments", "balance_cents")).toBeTruthy();
  });
});

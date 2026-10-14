import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getWelcomeFacts } from "@/lib/db/queries";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0036_welcome_step.sql and what the welcome card ticks, on a real
// database: the column exists and the migration runs again, the facts follow
// real rows, and the rollback file undoes the column.
describeDb("migration 0036 (welcome step) and the welcome facts", () => {
  const scope = makeScope("m0036");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await sql`DELETE FROM notification_preferences WHERE member_id = ${scope.memberId}`;
    await scope.cleanup();
  });

  it("applies again without errors and leaves the step empty", async () => {
    const statements = readFileSync("drizzle/0036_welcome_step.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(1);
    for (const statement of statements) await runSql(statement);
    const [row] = await sql`SELECT welcome_step FROM members WHERE member_id = ${scope.memberId}`;
    expect(row.welcome_step).toBeNull();
  });

  it("ticks nothing for a newcomer", async () => {
    expect(await getWelcomeFacts(scope.memberId, scope.memberId)).toEqual({
      money: false,
      ordered: false,
      preferences: false,
      family: false,
    });
  });

  it("ticks the money step after a top-up, and not after one that was reversed", async () => {
    await scope.createPaidTopup("first", 1000);
    expect((await getWelcomeFacts(scope.memberId, scope.memberId)).money).toBe(true);
    // A reversed top-up is not money moved.
    await sql`UPDATE ledger_entries SET reversed_by = ${scope.id("rev")} WHERE entry_id = ${scope.id("led_first")}`;
    expect((await getWelcomeFacts(scope.memberId, scope.memberId)).money).toBe(false);
  });

  it("ticks the order, preferences and family steps from their rows", async () => {
    const { cycleId, productIds } = await scope.createCycle("c1", { products: [{ name: "Bread", unitPrice: 2 }] });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("line1")}, ${cycleId}, ${scope.memberId}, ${productIds[0]}, 1, 2, '2.00', now())`;
    await sql`INSERT INTO notification_preferences (member_id, category, app_enabled, email_enabled, updated_at)
      VALUES (${scope.memberId}, 'order_charge', true, false, now())`;
    const other = await scope.createExtraMember("fam");
    await sql`UPDATE members SET household_of = ${scope.memberId} WHERE member_id = ${other}`;
    expect(await getWelcomeFacts(scope.memberId, scope.memberId)).toMatchObject({ ordered: true, preferences: true, family: true });
    // The linked person sees the family tick too, but not the account's preferences.
    expect(await getWelcomeFacts(scope.memberId, other)).toMatchObject({ preferences: false, family: true });
  });

  it("has a rollback that drops the column, and the column can come back", async () => {
    const down = readFileSync("drizzle/0036_welcome_step_down.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n")
      .trim()
      .replace(/;$/, "");
    await runSql(down);
    const gone = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'welcome_step'`;
    expect(gone).toHaveLength(0);
    await runSql("ALTER TABLE members ADD COLUMN IF NOT EXISTS welcome_step text");
  });
});

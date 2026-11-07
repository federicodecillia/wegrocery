import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0051_terms_acceptance.sql on a real database: the switch starts off,
// nobody has accepted anything, and the rollback file undoes it.
describeDb("migration 0051 (terms acceptance)", () => {
  const scope = makeScope("m0051");
  const { sql } = scope;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const columns = () => sql`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'app_settings' AND column_name IN ('terms_required', 'terms_version'))
        OR (table_name = 'members' AND column_name IN ('terms_accepted_at', 'terms_accepted_version')))`;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors, nothing accepted", async () => {
    for (const statement of statements("drizzle/0051_terms_acceptance.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(4);
    const [row] = await sql`SELECT terms_accepted_at, terms_accepted_version FROM members WHERE member_id = ${scope.memberId}`;
    expect(row.terms_accepted_at).toBeNull();
    expect(row.terms_accepted_version).toBeNull();
  });

  it("has a rollback that drops the columns", async () => {
    for (const statement of statements("drizzle/0051_terms_acceptance_down.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(0);
    for (const statement of statements("drizzle/0051_terms_acceptance.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(4);
  });
});

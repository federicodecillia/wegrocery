import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getPublicCycles, getPublicProducts } from "@/lib/db/public";
import { describeDb, makeScope, runSql } from "./fixtures";

// The public page (drizzle/0053_public_page.sql, lib/db/public.ts) on a real
// database: off by default, and only cycles open to every member reach it.
describeDb("public page (migration 0053)", () => {
  const scope = makeScope("public");
  const { sql } = scope;
  const statements = (file: string) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const columns = () => sql`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name IN ('public_page_enabled', 'public_products_preview', 'public_page_indexable', 'public_intro')`;
  let everyone = "";
  let adminOnly = "";

  beforeAll(async () => {
    await scope.createMember();
    // The fixture's cycles are admin-only; one is opened to everyone.
    everyone = (await scope.createCycle("everyone", { products: [{ name: "Mele", unitPrice: 2.5 }] })).cycleId;
    adminOnly = (await scope.createCycle("admins", { products: [{ name: "Pere", unitPrice: 3 }] })).cycleId;
    await sql`UPDATE order_cycles SET access_level = 'utenti' WHERE cycle_id = ${everyone}`;
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors, everything off", async () => {
    for (const statement of statements("drizzle/0053_public_page.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(4);
    const defaults = await sql`
      SELECT column_name, column_default FROM information_schema.columns
      WHERE table_name = 'app_settings'
        AND column_name IN ('public_page_enabled', 'public_products_preview', 'public_page_indexable')`;
    for (const d of defaults) expect(d.column_default, d.column_name as string).toBe("false");
  });

  it("lists cycles open to every member, never admin-only ones", async () => {
    const ids = (await getPublicCycles()).map((c) => c.cycleId);
    expect(ids).toContain(everyone);
    expect(ids).not.toContain(adminOnly);
    const products = await getPublicProducts(everyone);
    expect(products.map((p) => [p.name, p.unitPrice])).toEqual([["Mele", "2.50"]]);
  });

  it("refuses a text over 2000 characters", async () => {
    // An upsert, not an UPDATE: a fresh database has no settings row yet, and
    // the check refuses the text either way, so nothing is written.
    const long = "x".repeat(2001);
    await expect(sql`
      INSERT INTO app_settings (id, bank_transfer_enabled, online_payments_enabled, updated_at, updated_by, public_intro)
      VALUES (1, false, true, now(), 'int-test', ${long})
      ON CONFLICT (id) DO UPDATE SET public_intro = EXCLUDED.public_intro`).rejects.toThrow(/public_intro_length|check/i);
  });

  it("has a rollback that drops the columns", async () => {
    for (const statement of statements("drizzle/0053_public_page_down.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(0);
    for (const statement of statements("drizzle/0053_public_page.sql")) await runSql(statement);
    expect((await columns())[0].n).toBe(4);
  });
});

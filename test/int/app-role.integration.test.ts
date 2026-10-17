import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, expect, it } from "vitest";
import { appRoleRevokeStatements, appRoleStatements } from "@/scripts/db-migrate-lib.mjs";
import { describeDb, rawClient } from "./fixtures";

// Playbook 1.4: the restricted role reads and writes data, and nothing else.
describeDb("app role (restricted database role)", () => {
  const role = "int_app_rw";
  // Neon refuses a guessable password, so a random one.
  const password = randomBytes(24).toString("base64url");
  let asApp: ReturnType<typeof neon>;

  beforeAll(async () => {
    const owner = rawClient();
    const [{ db }] = await owner`SELECT current_database() AS db`;
    for (const statement of appRoleStatements(role, password, db as string)) await owner.query(statement);
    const url = new URL(process.env.DATABASE_URL!);
    url.username = role;
    url.password = password;
    asApp = neon(url.toString());
  });

  afterAll(async () => {
    const owner = rawClient();
    const [{ db }] = await owner`SELECT current_database() AS db`;
    for (const statement of appRoleRevokeStatements(role, db as string)) await owner.query(statement);
  });

  it("reads the data and the migration ledger", async () => {
    await expect(asApp`SELECT count(*) FROM members`).resolves.toHaveLength(1);
    await expect(asApp`SELECT count(*) FROM _migrations`).resolves.toHaveLength(1);
  });

  it("cannot change the schema, drop the ledger trigger or write the migration ledger", async () => {
    await expect(asApp.query("CREATE TABLE int_app_rw_probe (id int)")).rejects.toThrow();
    await expect(asApp.query("DROP TABLE members")).rejects.toThrow();
    await expect(asApp.query("DROP TRIGGER ledger_entries_append_only ON ledger_entries")).rejects.toThrow();
    await expect(asApp.query("INSERT INTO _migrations (name) VALUES ('int_probe')")).rejects.toThrow();
  });

  it("is safe to run twice", async () => {
    const owner = rawClient();
    const [{ db }] = await owner`SELECT current_database() AS db`;
    for (const statement of appRoleStatements(role, password, db as string)) await owner.query(statement);
    await expect(asApp`SELECT 1 AS ok`).resolves.toEqual([{ ok: 1 }]);
  });
});

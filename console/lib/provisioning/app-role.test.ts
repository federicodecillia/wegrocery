import { describe, expect, it } from "vitest";
import * as app from "../../../scripts/db-migrate-lib.mjs";
import { APP_ROLE, appRoleStatements, createAppRole, migrationLedgerRevokeStatement, roleUrl, type SqlRunner } from "./app-role";

const OWNER = "postgresql://neondb_owner:owner-pw@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("same statements as the app", () => {
  it("creates the role exactly as scripts/db-migrate-lib.mjs does", () => {
    const pw = "p".repeat(32);
    expect(appRoleStatements(APP_ROLE, pw, "neondb")).toEqual(app.appRoleStatements(APP_ROLE, pw, "neondb"));
    expect(migrationLedgerRevokeStatement(APP_ROLE)).toBe(app.migrationLedgerRevokeStatement(APP_ROLE));
    expect(roleUrl(OWNER, APP_ROLE, "a/b+c")).toBe(app.roleUrl(OWNER, APP_ROLE, "a/b+c"));
  });
});

/** A fake database: records the statements per user and answers the two selects. */
function fakeDb(opts: { canCreate?: boolean; failOn?: RegExp } = {}) {
  const log: { user: string; text: string }[] = [];
  const runnerFor = (url: string): SqlRunner => {
    const user = new URL(url).username;
    return async (text) => {
      log.push({ user, text });
      if (opts.failOn?.test(text)) throw Object.assign(new Error(`boom at ${url}`), { code: "42501" });
      if (text.startsWith("SELECT current_database()")) return [{ db: "neondb" }];
      if (text.includes("has_schema_privilege")) return [{ can_create: opts.canCreate ?? false }];
      return [];
    };
  };
  return { log, runnerFor };
}

describe("createAppRole", () => {
  it("creates the role as the owner, checks it as the role and returns its address", async () => {
    const db = fakeDb();
    const { appUrl } = await createAppRole(OWNER, db.runnerFor);
    const u = new URL(appUrl);
    expect(u.username).toBe("app_rw");
    expect(decodeURIComponent(u.password)).toHaveLength(32);
    expect(u.host).toBe("ep-x-pooler.eu-central-1.aws.neon.tech");
    expect(u.search).toBe("?sslmode=require");
    const owner = db.log.filter((l) => l.user === "neondb_owner").map((l) => l.text);
    expect(owner[1]).toContain('CREATE ROLE "app_rw" LOGIN PASSWORD');
    expect(owner.some((t) => t.startsWith("ALTER DEFAULT PRIVILEGES"))).toBe(true);
    expect(db.log.at(-1)).toMatchObject({ user: "app_rw" });
    expect(db.log.at(-1)!.text).toContain("has_schema_privilege");
  });

  it("uses a new password each time", async () => {
    const a = await createAppRole(OWNER, fakeDb().runnerFor);
    const b = await createAppRole(OWNER, fakeDb().runnerFor);
    expect(new URL(a.appUrl).password).not.toBe(new URL(b.appUrl).password);
  });

  it("fails when the role can still create objects", async () => {
    await expect(createAppRole(OWNER, fakeDb({ canCreate: true }).runnerFor)).rejects.toThrow(/può ancora creare/);
  });

  it("fails without echoing the driver's message, which could carry an address", async () => {
    const err = await createAppRole(OWNER, fakeDb({ failOn: /GRANT CONNECT/ }).runnerFor).then(
      () => new Error("expected a failure"),
      (e: Error) => e,
    );
    expect(err.message).toBe("Neon: ruolo app_rw: creazione non riuscita (codice 42501)");
    expect(err.message).not.toContain("owner-pw");
  });

  it("fails when the role cannot connect", async () => {
    await expect(createAppRole(OWNER, fakeDb({ failOn: /has_schema_privilege/ }).runnerFor)).rejects.toThrow(
      /collegamento di prova non riuscito/,
    );
  });
});

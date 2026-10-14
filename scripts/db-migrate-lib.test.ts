import { describe, expect, it } from "vitest";
import { appRoleRevokeStatements, appRoleStatements, isMigrationFile, refusesProduction, roleUrl, splitStatements } from "./db-migrate-lib.mjs";

describe("isMigrationFile", () => {
  it("applies numbered SQL and never a rollback file", () => {
    expect(isMigrationFile("0036_thing.sql")).toBe(true);
    expect(isMigrationFile("0036_thing_down.sql")).toBe(false);
    expect(isMigrationFile("README.md")).toBe(false);
  });
});

describe("splitStatements", () => {
  it("splits on semicolons and drops comment lines, even with SQL in them", () => {
    const raw = "-- example: SELECT 1; SELECT 2;\nCREATE TABLE a (id int);\nCREATE INDEX i ON a (id);\n";
    expect(splitStatements(raw)).toEqual(["CREATE TABLE a (id int)", "CREATE INDEX i ON a (id)"]);
  });

  it("splits on drizzle's statement-breakpoint when present", () => {
    const raw = "CREATE TABLE a (x text DEFAULT ';');--> statement-breakpoint\nCREATE TABLE b (id int);";
    expect(splitStatements(raw)).toEqual(["CREATE TABLE a (x text DEFAULT ';')", "CREATE TABLE b (id int)"]);
  });

  it("drops a file's own BEGIN and COMMIT: the runner wraps the file in a transaction", () => {
    expect(splitStatements("BEGIN;\nALTER TABLE a ADD COLUMN b int;\nCOMMIT;")).toEqual(["ALTER TABLE a ADD COLUMN b int"]);
  });
});

describe("refusesProduction", () => {
  const prod = "postgres://u:p@ep-prod.eu-central-1.aws.neon.tech/db";
  const env = { PRODUCTION_DB_HOST: "ep-prod.eu-central-1.aws.neon.tech" };

  it("refuses the production host without --allow-prod", () => {
    expect(refusesProduction(prod, env, [])).toBe(true);
    expect(refusesProduction(prod, env, ["--status"])).toBe(true);
  });

  it("lets --allow-prod through", () => {
    expect(refusesProduction(prod, env, ["--allow-prod"])).toBe(false);
  });

  it("leaves other hosts alone", () => {
    expect(refusesProduction("postgres://u:p@ep-dev.neon.tech/db", env, [])).toBe(false);
  });

  it("knows nothing about production without PRODUCTION_DB_HOST", () => {
    expect(refusesProduction(prod, {}, [])).toBe(false);
  });
});

describe("appRoleStatements", () => {
  const all = (role = "app_rw", pw = "p".repeat(24)) => appRoleStatements(role, pw, "neondb").join("\n");

  it("grants data access only: no DDL, no ownership, no superuser", () => {
    const sql = all();
    expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public");
    expect(sql).toContain("NOSUPERUSER NOCREATEDB NOCREATEROLE");
    expect(sql).not.toMatch(/GRANT (ALL|CREATE)\b|OWNER TO|TRUNCATE|REFERENCES/i);
  });

  it("covers the tables created later and keeps the migration ledger read only", () => {
    const sql = all();
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public._migrations");
  });

  it("refuses a role name that is not a plain identifier and a short password", () => {
    expect(() => appRoleStatements('x"; DROP TABLE members; --', "p".repeat(24), "db")).toThrow(/invalid role/);
    expect(() => appRoleStatements("app_rw", "short", "db")).toThrow(/24 characters/);
  });

  it("quotes a password with a single quote", () => {
    expect(all("app_rw", "a'b".padEnd(24, "x"))).toContain("'a''bxxxxxxxxxxxxxxxxxxxxx'");
  });
});

describe("appRoleRevokeStatements", () => {
  it("revokes everything and drops the role", () => {
    const sql = appRoleRevokeStatements("app_rw", "neondb");
    expect(sql.at(-1)).toBe('DROP ROLE IF EXISTS "app_rw"');
    expect(sql.join("\n")).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "app_rw"');
  });
});

describe("roleUrl", () => {
  it("swaps user and password, keeps host, database and options, encodes the password", () => {
    const out = roleUrl("postgresql://neondb_owner:old@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require", "app_rw", "a/b+c=d");
    const u = new URL(out);
    expect(u.username).toBe("app_rw");
    expect(decodeURIComponent(u.password)).toBe("a/b+c=d");
    expect(u.host).toBe("ep-x.eu-central-1.aws.neon.tech");
    expect(u.pathname).toBe("/neondb");
    expect(u.search).toBe("?sslmode=require");
  });
});

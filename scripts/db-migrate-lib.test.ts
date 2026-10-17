import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCK_TIMEOUT,
  ROLLBACK_REQUIRED_FROM,
  appRoleFromEnv,
  appRoleRevokeStatements,
  appRoleStatements,
  isMigrationFile,
  migrationLedgerRevokeStatement,
  nonTransactionalStatement,
  refusesProduction,
  roleUrl,
  splitStatements,
} from "./db-migrate-lib.mjs";

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

describe("nonTransactionalStatement", () => {
  it("refuses what Postgres cannot run in a transaction", () => {
    for (const st of [
      "CREATE INDEX CONCURRENTLY i ON a (id)",
      "create unique index concurrently if not exists i on a (id)",
      "DROP INDEX CONCURRENTLY i",
      "REINDEX INDEX CONCURRENTLY i",
      "ALTER TABLE p DETACH PARTITION c CONCURRENTLY",
      "VACUUM ANALYZE a",
      "ALTER SYSTEM SET work_mem = '64MB'",
      "CREATE DATABASE x",
      "REINDEX DATABASE neondb",
    ]) {
      expect(nonTransactionalStatement(["CREATE TABLE a (id int)", st])).toBe(st);
    }
  });

  it("lets ordinary DDL, DML and DO blocks through", () => {
    expect(
      nonTransactionalStatement([
        "CREATE INDEX IF NOT EXISTS i ON a (id)",
        "ALTER TABLE a ADD COLUMN b int",
        "ALTER TYPE t ADD VALUE IF NOT EXISTS 'x'",
        "REINDEX TABLE a",
        "DO $$ BEGIN RAISE NOTICE 'ok'; END $$",
        "UPDATE a SET b = 1",
      ]),
    ).toBeNull();
  });
});

// Playbook 6.2: every file in drizzle/ runs in one transaction with a lock
// timeout, and from ROLLBACK_REQUIRED_FROM on each ships with its rollback.
describe("the migrations in drizzle/", () => {
  const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
  const migrations = files.filter(isMigrationFile);
  const number = (f: string) => Number(f.slice(0, 4));

  it("are numbered NNNN_name.sql, one per number", () => {
    for (const f of files) expect(f).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    expect(new Set(migrations.map(number)).size).toBe(migrations.length);
  });

  it("can all run inside a transaction", () => {
    const refused = migrations.flatMap((f) => {
      const st = nonTransactionalStatement(splitStatements(readFileSync(`drizzle/${f}`, "utf8")));
      return st ? [`${f}: ${st}`] : [];
    });
    expect(refused).toEqual([]);
  });

  it("wait at most 5 seconds for a lock", () => {
    expect(LOCK_TIMEOUT).toBe("5s");
  });

  it(`from ${ROLLBACK_REQUIRED_FROM} on, come with a _down.sql and an Apply/Rollback header`, () => {
    const recent = migrations.filter((f) => number(f) >= ROLLBACK_REQUIRED_FROM);
    expect(recent.length).toBeGreaterThan(0);
    for (const f of recent) {
      const down = f.replace(/\.sql$/, "_down.sql");
      expect(files, `${f} needs drizzle/${down}`).toContain(down);
      const header = readFileSync(`drizzle/${f}`, "utf8");
      expect(header, `${f} header`).toMatch(/^-- Apply:/m);
      expect(header, `${f} header`).toMatch(new RegExp(`^-- Rollback:.*${down}`, "m"));
    }
  });

  it("have no rollback file without its migration", () => {
    for (const f of files.filter((n) => n.endsWith("_down.sql"))) {
      expect(migrations).toContain(f.replace(/_down\.sql$/, ".sql"));
    }
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

describe("migrationLedgerRevokeStatement", () => {
  it("takes write access to the ledger away, only when ledger and role exist", () => {
    const sql = migrationLedgerRevokeStatement("app_rw");
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public._migrations FROM "app_rw"');
    expect(sql).toContain("to_regclass('public._migrations') IS NOT NULL");
    expect(sql).toContain("rolname = 'app_rw'");
  });

  it("refuses a role name that is not a plain identifier", () => {
    expect(() => migrationLedgerRevokeStatement("x'; DROP TABLE members; --")).toThrow(/invalid role/);
  });
});

describe("appRoleFromEnv", () => {
  const owner = "postgresql://neondb_owner:o@ep-x.neon.tech/neondb";
  const app = "postgresql://app_rw:a@ep-x.neon.tech/neondb";

  it("is the app's user while migrations run as another user", () => {
    expect(appRoleFromEnv({ DATABASE_URL: app, DATABASE_MIGRATION_URL: owner })).toBe("app_rw");
  });

  it("is null with one address, the same user twice or an unreadable address", () => {
    expect(appRoleFromEnv({ DATABASE_URL: owner })).toBeNull();
    expect(appRoleFromEnv({ DATABASE_MIGRATION_URL: owner })).toBeNull();
    expect(appRoleFromEnv({ DATABASE_URL: owner, DATABASE_MIGRATION_URL: owner })).toBeNull();
    expect(appRoleFromEnv({ DATABASE_URL: "not a url", DATABASE_MIGRATION_URL: owner })).toBeNull();
  });
});

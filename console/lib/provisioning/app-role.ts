import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ProviderError } from "@/lib/http";

// The restricted role a new instance's app connects with (FlyLabs Playbook
// 1.4): rows only, no DDL, so a leaked DATABASE_URL cannot drop a table or
// the ledger's append-only trigger. The owner's address stays for migrations
// (DATABASE_MIGRATION_URL). The statements are the ones of the app's
// scripts/db-migrate-lib.mjs, copied because the console builds on its own;
// app-role.test.ts fails when the two differ. Passwords and addresses live
// only in memory and go straight to Vercel.

export const APP_ROLE = "app_rw";

const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** Idempotent: running it again resets the password and re-grants new tables. */
export function appRoleStatements(role: string, password: string, database: string): string[] {
  if (!ROLE_NAME.test(role)) throw new Error(`invalid role name: ${role}`);
  if (password.length < 24) throw new Error("the password needs at least 24 characters");
  const ident = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const literal = (v: string) => `'${v.replaceAll("'", "''")}'`;
  return [
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${literal(role)}) THEN
        CREATE ROLE ${ident(role)} LOGIN PASSWORD ${literal(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE;
      ELSE
        ALTER ROLE ${ident(role)} PASSWORD ${literal(password)};
      END IF;
    END $$`,
    `GRANT CONNECT ON DATABASE ${ident(database)} TO ${ident(role)}`,
    `GRANT USAGE ON SCHEMA public TO ${ident(role)}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ident(role)}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ident(role)}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ident(role)}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ident(role)}`,
    migrationLedgerRevokeStatement(role),
  ];
}

/** The migration ledger is never written by the app (see the app's db-migrate). */
export function migrationLedgerRevokeStatement(role: string): string {
  if (!ROLE_NAME.test(role)) throw new Error(`invalid role name: ${role}`);
  const literal = `'${role}'`;
  return `DO $$ BEGIN
      IF to_regclass('public._migrations') IS NOT NULL AND EXISTS (SELECT FROM pg_roles WHERE rolname = ${literal}) THEN
        REVOKE INSERT, UPDATE, DELETE ON public._migrations FROM "${role}";
      END IF;
    END $$`;
}

/** The owner's address with the role's name and password (URL-encoded). */
export function roleUrl(ownerUrl: string, role: string, password: string): string {
  const u = new URL(ownerUrl);
  u.username = role;
  u.password = password;
  return u.toString();
}

export type SqlRunner = (text: string) => Promise<Record<string, unknown>[]>;

const neonRunner = (url: string): SqlRunner => {
  const sql = neon(url);
  return (text) => sql.query(text) as Promise<Record<string, unknown>[]>;
};

/** A Postgres error code is safe to show; a driver message might not be. */
function failure(stage: string, e: unknown): ProviderError {
  const code = typeof e === "object" && e && "code" in e && typeof e.code === "string" ? ` (codice ${e.code})` : "";
  return new ProviderError("Neon", 0, `ruolo ${APP_ROLE}: ${stage} non riuscit${stage === "creazione" ? "a" : "o"}${code}`);
}

/**
 * Creates (or refreshes) the role on the instance's database, connected as
 * the owner, then connects as the role and checks it cannot create objects.
 * Returns the role's address; throws, before anything reaches Vercel, when
 * a step fails or the role can still change the schema.
 */
export async function createAppRole(
  ownerUrl: string,
  runnerFor: (url: string) => SqlRunner = neonRunner,
): Promise<{ appUrl: string }> {
  const password = randomBytes(24).toString("base64url");
  const owner = runnerFor(ownerUrl);
  try {
    const [{ db }] = await owner("SELECT current_database() AS db");
    for (const statement of appRoleStatements(APP_ROLE, password, String(db))) await owner(statement);
  } catch (e) {
    throw failure("creazione", e);
  }
  const appUrl = roleUrl(ownerUrl, APP_ROLE, password);
  let canCreate: unknown;
  try {
    [{ can_create: canCreate }] = await runnerFor(appUrl)(
      "SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create",
    );
  } catch (e) {
    throw failure("collegamento di prova", e);
  }
  if (canCreate !== false) throw new ProviderError("Neon", 0, `il ruolo ${APP_ROLE} può ancora creare oggetti in public`);
  return { appUrl };
}

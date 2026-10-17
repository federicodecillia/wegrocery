// Pure helpers of scripts/db-migrate.mjs, kept apart so they can be tested
// without a database.

/** True for the files the runner applies: numbered SQL, never a `_down.sql`. */
export function isMigrationFile(name) {
  return name.endsWith(".sql") && !name.endsWith("_down.sql");
}

/**
 * The statements of a migration file. Statements are separated by drizzle's
 * `--> statement-breakpoint` marker when present, otherwise by semicolons after
 * stripping `--` comment lines (some file headers contain example SQL with
 * semicolons inside comments). A file's own BEGIN / COMMIT are dropped: the
 * runner wraps the whole file in one transaction.
 */
export function splitStatements(raw) {
  const withoutComments = (s) =>
    s
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
  const parts = raw.includes("--> statement-breakpoint")
    ? raw.split("--> statement-breakpoint").map(withoutComments)
    : withoutComments(raw).split(";");
  return parts
    .map((s) => s.trim().replace(/;$/, ""))
    .filter(Boolean)
    .filter((s) => !/^(BEGIN|COMMIT)$/i.test(s));
}

/**
 * Playbook 6.4: a script that writes to the database refuses production
 * without an explicit flag. Production is the host named by
 * PRODUCTION_DB_HOST; without that variable nothing is known to be
 * production (a self-hosted install, CI, the demo) and nothing is refused.
 */
export function refusesProduction(url, env, argv) {
  const productionHost = env.PRODUCTION_DB_HOST?.trim();
  if (!productionHost) return false;
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }
  return host === productionHost && !argv.includes("--allow-prod");
}

/**
 * The app's address for a role: the owner's address with the role's name and
 * password (URL-encoded by the URL class). Used by create-app-role.mjs to save
 * the address without ever printing it.
 */
export function roleUrl(ownerUrl, role, password) {
  const u = new URL(ownerUrl);
  u.username = role;
  u.password = password;
  return u.toString();
}

/**
 * How long a migration may wait for a lock before it gives up (Playbook 6.2):
 * the file then rolls back whole and can be run again, instead of queueing
 * the app's queries behind it.
 */
export const LOCK_TIMEOUT = "5s";

/**
 * The first statement of a migration that cannot run inside a transaction,
 * or null. The runner wraps each file in one transaction (one HTTP request
 * of the Neon driver), where Postgres refuses CREATE INDEX, DROP INDEX,
 * REINDEX and DETACH PARTITION with CONCURRENTLY, VACUUM, ALTER SYSTEM,
 * REINDEX of a whole database, and creating or dropping a database, a
 * tablespace or a subscription. Every CONCURRENTLY is refused, as the
 * Playbook says, even the REFRESH MATERIALIZED VIEW that would work. The
 * runner refuses such a file before applying anything: write a plain CREATE
 * INDEX instead, or a step run by hand. `ALTER TYPE ... ADD VALUE` is allowed
 * in a transaction, but the new value cannot be used before the file
 * commits: put its use in the next file.
 */
export function nonTransactionalStatement(statements) {
  const refused = [
    /\bCONCURRENTLY\b/i,
    /^(VACUUM|ALTER\s+SYSTEM)\b/i,
    /^(CREATE|DROP)\s+(DATABASE|TABLESPACE|SUBSCRIPTION)\b/i,
    /^REINDEX\s+(\([^)]*\)\s*)?(SYSTEM|DATABASE)\b/i,
  ];
  return statements.find((st) => refused.some((re) => re.test(st.trim()))) ?? null;
}

/** First migration number that must ship with a `_down.sql` and an Apply/Rollback header. */
export const ROLLBACK_REQUIRED_FROM = 36;

/**
 * Playbook 1.4: the statements that give the app a role with data access only
 * (SELECT, INSERT, UPDATE, DELETE; no DDL, no ownership, so it cannot drop the
 * ledger trigger or a table). Idempotent: running it again resets the password
 * and re-grants the tables created since. `database` is the current database.
 */
export function appRoleStatements(role, password, database) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error(`invalid role name: ${role}`);
  if (password.length < 24) throw new Error("the password needs at least 24 characters");
  const ident = (v) => `"${v.replaceAll('"', '""')}"`;
  const literal = (v) => `'${v.replaceAll("'", "''")}'`;
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

/**
 * The migration ledger is read by the configuration status, never written by
 * the app. A role created before the ledger exists (a new installation) gets
 * write access to it through the default privileges, so db-migrate.mjs runs
 * this again after creating the ledger. A no-op when the ledger or the role
 * does not exist.
 */
export function migrationLedgerRevokeStatement(role) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error(`invalid role name: ${role}`);
  const literal = `'${role}'`;
  return `DO $$ BEGIN
      IF to_regclass('public._migrations') IS NOT NULL AND EXISTS (SELECT FROM pg_roles WHERE rolname = ${literal}) THEN
        REVOKE INSERT, UPDATE, DELETE ON public._migrations FROM "${role}";
      END IF;
    END $$`;
}

/**
 * The restricted role the app connects with, when migrations run with a
 * different (owner) address: the user of DATABASE_URL while
 * DATABASE_MIGRATION_URL is set to another user. Null otherwise.
 */
export function appRoleFromEnv(env) {
  const appUrl = env.DATABASE_URL?.trim();
  const migrationUrl = env.DATABASE_MIGRATION_URL?.trim();
  if (!appUrl || !migrationUrl) return null;
  try {
    const app = decodeURIComponent(new URL(appUrl).username);
    const owner = decodeURIComponent(new URL(migrationUrl).username);
    return app && app !== owner && /^[a-z_][a-z0-9_]{0,62}$/.test(app) ? app : null;
  } catch {
    return null;
  }
}

/**
 * The way back: takes every privilege away and drops the role (on Neon the
 * owner cannot DROP OWNED BY, so privileges are revoked one by one).
 */
export function appRoleRevokeStatements(role, database) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error(`invalid role name: ${role}`);
  const ident = (v) => `"${v.replaceAll('"', '""')}"`;
  const r = ident(role);
  return [
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${r}`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${r}`,
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${r}`,
    `REVOKE ALL ON SCHEMA public FROM ${r}`,
    `REVOKE ALL ON DATABASE ${ident(database)} FROM ${r}`,
    `DROP ROLE IF EXISTS ${r}`,
  ];
}

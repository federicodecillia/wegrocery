// Deterministic migration runner for the hand-written SQL files in drizzle/
// (issue #85). Tracks applied files in a `_migrations` table so "apply
// pending" is one command per environment; used instead of drizzle-kit
// migrate because the journal only covers 0000 and retrofitting snapshots
// onto hand-written SQL invites permanent spurious diffs.
//
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs             # apply pending
//   (DATABASE_MIGRATION_URL, when set, wins: the owner's address while the app
//   runs as a restricted role, see scripts/create-app-role.mjs)
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --baseline  # record all as applied, run nothing
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --status    # list applied vs pending
//
// Each file runs in one transaction with `SET LOCAL lock_timeout` (5 s), and
// is recorded in the same transaction: a failure leaves the database as it
// was and the file stays pending. The Neon driver sends the whole file as one
// HTTP request (`sql.transaction`), so a file cannot hold a statement that
// Postgres refuses inside a transaction (CREATE INDEX CONCURRENTLY, VACUUM):
// the runner checks every pending file first and refuses to start. A file named
// `NNNN_name_down.sql` is the rollback of `NNNN_name.sql`; the runner never
// applies it (run it by hand, see docs/upgrading.md). When PRODUCTION_DB_HOST
// names this database the runner needs --allow-prod (FlyLabs Playbook 6.4).
//
// Baseline is for databases whose schema is already current (prod/demo/dev
// as of 0010): it seeds the ledger so only future files ever run.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
  LOCK_TIMEOUT,
  appRoleFromEnv,
  isMigrationFile,
  migrationLedgerRevokeStatement,
  nonTransactionalStatement,
  refusesProduction,
  splitStatements,
} from "./db-migrate-lib.mjs";

// The owner's connection when the app runs as a restricted role (Playbook 1.4).
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL (or DATABASE_MIGRATION_URL) is required");
  process.exit(1);
}
if (refusesProduction(url, process.env, process.argv)) {
  console.error(`${new URL(url).host} is the production database (PRODUCTION_DB_HOST): pass --allow-prod to run against it`);
  process.exit(1);
}
const mode = process.argv.includes("--baseline")
  ? "baseline"
  : process.argv.includes("--status")
    ? "status"
    : "apply";

const sql = neon(url);
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const files = readdirSync(dir).filter(isMigrationFile).sort();

console.log(`== ${new URL(url).host} · mode: ${mode} ==`);

await sql`CREATE TABLE IF NOT EXISTS _migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;
// A restricted app role created before the ledger existed must not write it.
const appRole = appRoleFromEnv(process.env);
if (appRole && mode !== "status") await sql.query(migrationLedgerRevokeStatement(appRole));
const appliedRows = await sql`SELECT name FROM _migrations`;
const applied = new Set(appliedRows.map((r) => r.name));
const pending = files.filter((f) => !applied.has(f));

if (mode === "status") {
  for (const f of files) console.log(`${applied.has(f) ? "applied" : "PENDING"}  ${f}`);
  process.exit(0);
}

if (mode === "baseline") {
  for (const f of pending) {
    await sql`INSERT INTO _migrations (name) VALUES (${f}) ON CONFLICT DO NOTHING`;
  }
  console.log(`baseline: recorded ${pending.length} file(s) as applied (nothing executed)`);
  process.exit(0);
}

// apply: run each pending file in one transaction, with the record of it.
// Every pending file is read and checked first: one that cannot run in a
// transaction (CREATE INDEX CONCURRENTLY...) stops the run before anything is
// applied, so the database is never left between two files for that reason.
const plan = pending.map((f) => ({ f, statements: splitStatements(readFileSync(join(dir, f), "utf8")) }));
for (const { f, statements } of plan) {
  const refused = nonTransactionalStatement(statements);
  if (refused) {
    console.error(
      `${f} cannot run in a transaction: "${refused.slice(0, 80)}". Each migration runs in one transaction with lock_timeout (FlyLabs Playbook 6.2): write it without CONCURRENTLY, VACUUM or database-level commands. Nothing was applied.`,
    );
    process.exit(1);
  }
}
for (const { f, statements } of plan) {
  console.log(`applying ${f} (${statements.length} statement(s))…`);
  await sql.transaction((txn) => [
    txn.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`),
    ...statements.map((st) => txn.query(st)),
    txn.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [f]),
  ]);
}
console.log(pending.length ? `✅ applied ${pending.length} migration(s)` : "✅ nothing pending");

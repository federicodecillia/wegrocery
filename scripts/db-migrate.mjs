// Deterministic migration runner for the hand-written SQL files in drizzle/
// (issue #85). Tracks applied files in a `_migrations` table so "apply
// pending" is one command per environment; used instead of drizzle-kit
// migrate because the journal only covers 0000 and retrofitting snapshots
// onto hand-written SQL invites permanent spurious diffs.
//
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs             # apply pending
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --baseline  # record all as applied, run nothing
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --status    # list applied vs pending
//
// Each file runs in one transaction with a lock timeout, and is recorded in
// the same transaction: a failure leaves the database as it was. A file named
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
import { LOCK_TIMEOUT, isMigrationFile, refusesProduction, splitStatements } from "./db-migrate-lib.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
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
for (const f of pending) {
  const statements = splitStatements(readFileSync(join(dir, f), "utf8"));
  console.log(`applying ${f} (${statements.length} statement(s))…`);
  await sql.transaction((txn) => [
    txn.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`),
    ...statements.map((st) => txn.query(st)),
    txn.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [f]),
  ]);
}
console.log(pending.length ? `✅ applied ${pending.length} migration(s)` : "✅ nothing pending");

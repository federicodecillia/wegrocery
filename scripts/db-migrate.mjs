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
// Baseline is for databases whose schema is already current (prod/demo/dev
// as of 0010): it seeds the ledger so only future files ever run.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const mode = process.argv.includes("--baseline")
  ? "baseline"
  : process.argv.includes("--status")
    ? "status"
    : "apply";

const sql = neon(url);
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

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

// apply: run each pending file, statement by statement, then record it.
// Statements are separated by drizzle's `--> statement-breakpoint` marker when
// present, otherwise by semicolons after stripping `--` comment lines (some
// file headers contain example SQL with semicolons inside comments).
for (const f of pending) {
  const raw = readFileSync(join(dir, f), "utf8");
  const stripped = raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const statements = (
    raw.includes("--> statement-breakpoint")
      ? raw.split("--> statement-breakpoint").map((s) =>
          s
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n"),
        )
      : stripped.split(";")
  )
    .map((s) => s.trim().replace(/;$/, ""))
    .filter(Boolean);

  console.log(`applying ${f} (${statements.length} statement(s))…`);
  for (const st of statements) {
    await sql.query(st);
  }
  await sql`INSERT INTO _migrations (name) VALUES (${f}) ON CONFLICT DO NOTHING`;
}
console.log(pending.length ? `✅ applied ${pending.length} migration(s)` : "✅ nothing pending");

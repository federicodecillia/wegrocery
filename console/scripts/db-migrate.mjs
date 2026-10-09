// Migration runner for the console's own registry database, modeled on the
// main app's scripts/db-migrate.mjs: applies the plain SQL files in
// console/drizzle/ in order and records each in a `_migrations` table.
//
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs           # apply pending
//   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --status  # list applied vs pending
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const mode = process.argv.includes("--status") ? "status" : "apply";

const sql = neon(url);
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Host only: never the credentials.
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

// Statements are split on semicolons after dropping `--` comment lines; the
// files must not contain functions with semicolons in their bodies.
for (const f of pending) {
  const statements = readFileSync(join(dir, f), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(`applying ${f} (${statements.length} statement(s))…`);
  for (const st of statements) await sql.query(st);
  await sql`INSERT INTO _migrations (name) VALUES (${f}) ON CONFLICT DO NOTHING`;
}
console.log(pending.length ? `applied ${pending.length} migration(s)` : "nothing pending");

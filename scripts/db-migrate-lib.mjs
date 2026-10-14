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

/** Seconds a migration may wait for a lock before it gives up. */
export const LOCK_TIMEOUT = "10s";

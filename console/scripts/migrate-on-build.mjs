// Runs before `next build`. With MIGRATE_ON_BUILD=true it applies the
// pending registry migrations first; a failing migration stops the build.
// Only production builds migrate (and builds outside Vercel), so a preview
// can never change the registry. Without the variable it does nothing, and
// the build needs no database at all (CI builds with no DATABASE_URL).
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const vercelEnv = process.env.VERCEL_ENV;
if (process.env.MIGRATE_ON_BUILD === "true") {
  if (vercelEnv && vercelEnv !== "production") {
    console.log(`MIGRATE_ON_BUILD: skipped on a ${vercelEnv} build (production only)`);
  } else {
    console.log("MIGRATE_ON_BUILD: applying pending migrations");
    const script = join(dirname(fileURLToPath(import.meta.url)), "db-migrate.mjs");
    execFileSync(process.execPath, [script], { stdio: "inherit" });
  }
}

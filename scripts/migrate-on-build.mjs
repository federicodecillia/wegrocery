// Runs before `next build`. With MIGRATE_ON_BUILD=true it applies the pending
// migrations first, so an installation upgrades with a redeploy; a failing
// migration stops the build. Only production builds migrate (and builds
// outside Vercel): the Deploy button sets the variable on every environment,
// and a preview build must never change the production database.
// Without it, it does nothing: migrations stay a manual step (docs/upgrading.md).
import { execFileSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV;
if (process.env.MIGRATE_ON_BUILD === "true") {
  if (vercelEnv && vercelEnv !== "production") {
    console.log(`MIGRATE_ON_BUILD: skipped on a ${vercelEnv} build (production only)`);
  } else {
    console.log("MIGRATE_ON_BUILD: applying pending migrations");
    execFileSync(process.execPath, ["scripts/db-migrate.mjs"], { stdio: "inherit" });
  }
}

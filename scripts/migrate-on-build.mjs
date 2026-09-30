// Runs before `next build`. With MIGRATE_ON_BUILD=true (set it on the
// production environment only) it applies the pending migrations first, so an
// installation upgrades with a redeploy; a failing migration stops the build.
// Without it, it does nothing: migrations stay a manual step (docs/upgrading.md).
import { execFileSync } from "node:child_process";

if (process.env.MIGRATE_ON_BUILD === "true") {
  console.log("MIGRATE_ON_BUILD: applying pending migrations");
  execFileSync(process.execPath, ["scripts/db-migrate.mjs"], { stdio: "inherit" });
}

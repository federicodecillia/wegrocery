// Creates (or refreshes) the restricted role the app connects with, so a leaked
// DATABASE_URL cannot change the schema (FlyLabs Playbook 1.4). Run it as the
// database owner:
//
//   DATABASE_URL="<owner address>" APP_ROLE_PASSWORD="<24+ chars>" \
//     node scripts/create-app-role.mjs [--role app_rw] [--allow-prod]
//
// Then set the app's DATABASE_URL to the same address with the role and its
// password, and keep the owner's address in DATABASE_MIGRATION_URL (read by
// scripts/db-migrate.mjs). Steps and rollback: docs/upgrading.md. The password
// is read from the environment and never printed.
import { neon } from "@neondatabase/serverless";
import { appRoleStatements, refusesProduction } from "./db-migrate-lib.mjs";

const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
const password = process.env.APP_ROLE_PASSWORD ?? "";
const roleFlag = process.argv.indexOf("--role");
const role = roleFlag > -1 ? process.argv[roleFlag + 1] : "app_rw";
if (!url || !password) {
  console.error("DATABASE_URL (the owner's address) and APP_ROLE_PASSWORD are required");
  process.exit(1);
}
if (refusesProduction(url, process.env, process.argv)) {
  console.error(`${new URL(url).host} is the production database (PRODUCTION_DB_HOST): pass --allow-prod to run against it`);
  process.exit(1);
}
const sql = neon(url);
const [{ db }] = await sql`SELECT current_database() AS db`;
console.log(`== ${new URL(url).host} · role: ${role} ==`);
for (const statement of appRoleStatements(role, password, db)) await sql.query(statement);
console.log(`✅ role ${role} ready: SELECT, INSERT, UPDATE, DELETE on public, no DDL`);

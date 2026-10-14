// Creates (or refreshes) the restricted role the app connects with, so a leaked
// DATABASE_URL cannot change the schema (FlyLabs Playbook 1.4). Run it as the
// database owner:
//
//   DATABASE_URL="<owner address>" APP_ROLE_PASSWORD="<24+ chars>" \
//     node scripts/create-app-role.mjs [--role app_rw] [--allow-prod]
//
// Without APP_ROLE_PASSWORD, --save-url <file> --save-as <NAME> generates one
// and appends NAME="<the role's address>" to <file> (mode 600), so nobody has
// to see or paste it. The script then connects as the role and checks that it
// cannot create objects. Nothing secret is printed.
//
// Then set the app's DATABASE_URL to the same address with the role and its
// password, and keep the owner's address in DATABASE_MIGRATION_URL (read by
// scripts/db-migrate.mjs). Steps and rollback: docs/upgrading.md. The password
// is read from the environment and never printed.
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { appRoleStatements, refusesProduction, roleUrl } from "./db-migrate-lib.mjs";

const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
const role = flag("--role") ?? "app_rw";
const saveTo = flag("--save-url");
const saveAs = flag("--save-as");
if (saveTo && !/^[A-Z][A-Z0-9_]*$/.test(saveAs ?? "")) {
  console.error("--save-url needs --save-as <NAME> (upper case letters, digits and underscores)");
  process.exit(1);
}
const password = process.env.APP_ROLE_PASSWORD || (saveTo ? randomBytes(24).toString("base64url") : "");
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
if (saveTo) {
  const address = roleUrl(url, role, password);
  appendFileSync(saveTo, `${saveAs}="${address}"\n`, { mode: 0o600 });
  const [{ can_create }] = await neon(address)`SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create`;
  if (can_create) {
    console.error(`${role} can still create objects in public: do not use its address`);
    process.exit(1);
  }
  console.log(`address saved as ${saveAs} in ${saveTo}; ${role} cannot create objects in public`);
}
console.log(`✅ role ${role} ready: SELECT, INSERT, UPDATE, DELETE on public, no DDL`);

// Read-only check of the money invariants (lib/invariants.ts) on the database
// in DATABASE_URL. Prints each check with the number of rows that break it and
// their ids (never member data); exits 1 if any breaks, so the nightly
// workflow fails and GitHub emails the owner.
//
//   node --env-file=.env.x node_modules/tsx/dist/cli.mjs scripts/check-invariants.mts
import { getDb } from "@/lib/db/client";
import { INVARIANT_CHECKS } from "@/lib/invariants";

let broken = 0;
for (const check of INVARIANT_CHECKS) {
  const { rows } = await getDb().execute<{ id: string }>(check.query);
  broken += rows.length;
  console.log(`${rows.length === 0 ? "ok  " : "FAIL"}  ${check.name}: ${check.description}`);
  for (const r of rows.slice(0, 20)) console.log(`        ${r.id}`);
  if (rows.length > 20) console.log(`        … and ${rows.length - 20} more`);
}
console.log(broken === 0 ? "All invariants hold." : `${broken} row(s) break an invariant.`);
process.exitCode = broken === 0 ? 0 : 1;

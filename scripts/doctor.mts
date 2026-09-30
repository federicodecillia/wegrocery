// What this deploy has set up, from the command line: the same checks as the
// "Configuration status" card in admin -> Impostazioni. Prints names and
// states only, never a value.
//
//   npm run doctor                          # reads .env.local
//   node --env-file=.env.x node_modules/tsx/dist/cli.mjs scripts/doctor.mts
import { neon } from "@neondatabase/serverless";
import { brandContrastWarnings } from "@/lib/brand/roles";
import { parseBrandConfig } from "@/lib/brand/parse";
import { configStatus } from "@/lib/config-status";

async function appliedMigrations(): Promise<string[] | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    const rows = await neon(url)`SELECT name FROM _migrations`;
    return rows.map((r) => String(r.name));
  } catch {
    return null;
  }
}

const brand = parseBrandConfig(process.env.NEXT_PUBLIC_BRAND_JSON);
const items = configStatus(process.env, {
  appliedMigrations: await appliedMigrations(),
  brandWarnings: brandContrastWarnings(brand.theme),
});

const MARK = { ok: "ok     ", missing: "MISSING", warning: "CHECK  ", off: "off    " } as const;
for (const item of items) {
  const note = item.note ? `  (${item.note})` : "";
  console.log(`${MARK[item.status]}  ${item.id.padEnd(11)} ${item.vars.join(", ")}${note}`);
  if (item.detail && item.status !== "off") for (const d of item.detail) console.log(`             - ${d}`);
}
process.exitCode = items.some((i) => i.status === "missing") ? 1 : 0;

// What this deploy has set up, from the command line: the same checks as the
// "Configuration status" card in admin -> Impostazioni. Prints names and
// states only, never a value.
//
//   npm run doctor                          # reads .env.local
//   node --env-file=.env.x node_modules/tsx/dist/cli.mjs scripts/doctor.mts
import { neon } from "@neondatabase/serverless";
import { brandContrastWarnings } from "@/lib/brand/roles";
import { brandUnknownFields, parseBrandConfig } from "@/lib/brand/parse";
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

async function hasActiveAdmin(): Promise<boolean | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    const rows = await neon(url)`SELECT 1 FROM members WHERE role = 'admin' AND active LIMIT 1`;
    return rows.length > 0;
  } catch {
    return null;
  }
}

// An invalid brand stops the build; here it is reported with the others.
const rawBrand = process.env.NEXT_PUBLIC_BRAND_JSON;
let brandError: string | null = null;
let brandWarnings: string[] = [];
try {
  brandWarnings = brandContrastWarnings(parseBrandConfig(rawBrand).theme);
} catch (e) {
  brandError = (e as Error).message;
}
const items = configStatus(process.env, {
  appliedMigrations: await appliedMigrations(),
  brandWarnings,
  brandError,
  brandUnknownFields: brandUnknownFields(rawBrand),
  hasActiveAdmin: await hasActiveAdmin(),
});

const MARK = { ok: "ok     ", missing: "MISSING", warning: "CHECK  ", off: "off    " } as const;
for (const item of items) {
  const note = item.note ? `  (${item.note})` : "";
  console.log(`${MARK[item.status]}  ${item.id.padEnd(11)} ${item.vars.join(", ")}${note}`);
  if (item.detail && item.status !== "off") for (const d of item.detail) console.log(`             - ${d}`);
}
process.exitCode = items.some((i) => i.status === "missing") ? 1 : 0;

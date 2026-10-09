import type { BrandConfig, BrandTheme } from "./types";

// The group's identity as its admins edit it in the app (first-run setup and
// Impostazioni), stored in group_identity (drizzle/0034_group_identity.sql)
// on top of NEXT_PUBLIC_BRAND_JSON: a field set here wins, a field left out
// keeps the brand JSON's value. Language, currency and time zone stay in the
// deploy's environment: they are chosen once and the formatting reads them at
// module load. Pure: the server side is lib/brand/get-brand.ts.

export const THEME_KEYS = ["primary", "primaryLight", "accent", "accentLight", "background", "frame"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export type IdentityOverrides = {
  appName?: string;
  shortName?: string;
  description?: string;
  orgName?: string;
  supportEmail?: string;
  techEmail?: string;
  archiveCcEmail?: string | null;
  privacyUrl?: string | null;
  membershipUrl?: string | null;
  headerShowName?: boolean;
  theme?: Partial<Record<ThemeKey, string>>;
};

export const TEXT_LIMITS = {
  appName: 60,
  shortName: 20,
  description: 200,
  orgName: 100,
} as const;

export type IdentityError =
  | "invalid"
  | "appNameRequired"
  | "shortNameRequired"
  | "tooLong"
  | "email"
  | "url"
  | "color";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function isHttpUrl(v: string): boolean {
  try {
    const { protocol } = new URL(v);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() : undefined);

// The admin's form, as sent: every field a string ("" = back to the brand
// JSON's value), headerShowName a boolean, theme an object of strings.
// Returns the overrides to store, or the first problem found.
export function validateIdentityInput(raw: unknown): { value: IdentityOverrides } | { error: IdentityError } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: "invalid" };
  const o = raw as Record<string, unknown>;
  const value: IdentityOverrides = {};

  for (const key of ["appName", "shortName", "description", "orgName"] as const) {
    if (o[key] === undefined) continue;
    const v = str(o[key]);
    if (v === undefined) return { error: "invalid" };
    if (v.length > TEXT_LIMITS[key]) return { error: "tooLong" };
    if (v) value[key] = v;
    else if (key === "appName") return { error: "appNameRequired" };
    else if (key === "shortName") return { error: "shortNameRequired" };
  }

  for (const key of ["supportEmail", "techEmail"] as const) {
    if (o[key] === undefined) continue;
    const v = str(o[key]);
    if (v === undefined) return { error: "invalid" };
    if (v.length > 254 || (v && !EMAIL.test(v))) return { error: "email" };
    if (v) value[key] = v.toLowerCase();
  }

  // Optional ones: "" stores null (no archive copy, no link), which differs
  // from leaving the field out (the brand JSON's value).
  if (o.archiveCcEmail !== undefined) {
    const v = str(o.archiveCcEmail);
    if (v === undefined) return { error: "invalid" };
    if (v.length > 254 || (v && !EMAIL.test(v))) return { error: "email" };
    value.archiveCcEmail = v ? v.toLowerCase() : null;
  }
  for (const key of ["privacyUrl", "membershipUrl"] as const) {
    if (o[key] === undefined) continue;
    const v = str(o[key]);
    if (v === undefined) return { error: "invalid" };
    if (v.length > 500 || (v && !isHttpUrl(v))) return { error: "url" };
    value[key] = v || null;
  }

  if (o.headerShowName !== undefined) {
    if (typeof o.headerShowName !== "boolean") return { error: "invalid" };
    value.headerShowName = o.headerShowName;
  }

  if (o.theme !== undefined) {
    if (typeof o.theme !== "object" || o.theme === null || Array.isArray(o.theme)) return { error: "invalid" };
    const t = o.theme as Record<string, unknown>;
    const theme: Partial<Record<ThemeKey, string>> = {};
    for (const key of THEME_KEYS) {
      if (t[key] === undefined) continue;
      const v = str(t[key]);
      if (v === undefined) return { error: "invalid" };
      if (v && !COLOR.test(v)) return { error: "color" };
      if (v) theme[key] = v.toLowerCase();
    }
    value.theme = theme;
  }

  return { value };
}

// Stored overrides merged into the next ones: a save of one step of the setup
// (contacts) keeps what another step (names, colours) saved.
export function mergeOverrides(stored: IdentityOverrides, next: IdentityOverrides): IdentityOverrides {
  const merged: IdentityOverrides = { ...stored, ...next };
  // A step that sends the theme sends all of it: the colours left empty go
  // back to the brand JSON's.
  if (next.theme !== undefined) merged.theme = next.theme;
  return merged;
}

// Reads what the database holds: unknown keys and wrong types are dropped,
// never trusted (a hand edit or an older version cannot break the layout).
export function readStoredOverrides(raw: unknown): IdentityOverrides {
  const result = validateIdentityInput(raw);
  if ("value" in result) return result.value;
  // A row that no longer validates as a whole: keep the fields that do.
  if (typeof raw !== "object" || raw === null) return {};
  const keep: IdentityOverrides = {};
  for (const [k, v] of Object.entries(raw)) {
    const one = validateIdentityInput({ [k]: v });
    if ("value" in one) Object.assign(keep, one.value);
  }
  return keep;
}

export type StoredLogo = { type: LogoType; updatedAt: Date };

// The brand in force: the deploy's brand JSON, then the admins' overrides,
// then the uploaded logo.
export function mergeIdentity(base: BrandConfig, overrides: IdentityOverrides, logo: StoredLogo | null): BrandConfig {
  const { theme, ...fields } = overrides;
  const merged: BrandConfig = { ...base, ...fields, theme: { ...base.theme, ...(theme as BrandTheme | undefined) } };
  if (logo) merged.logoUrl = logoPath(logo);
  return merged;
}

// ── Logo ────────────────────────────────────────────────────────────────────

export const LOGO_MAX_BYTES = 512 * 1024;
export type LogoType = "image/png" | "image/jpeg" | "image/webp";
const EXT: Record<LogoType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// The type from the file's first bytes, never from its name or the browser's
// claim. SVG is refused on purpose: served from the app's own origin it could
// carry script.
export function sniffLogoType(bytes: Uint8Array): LogoType | null {
  const at = (i: number, ...b: number[]) => b.every((x, j) => bytes[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

export function checkLogo(bytes: Uint8Array): { type: LogoType } | { error: "logoEmpty" | "logoTooBig" | "logoType" } {
  if (bytes.length === 0) return { error: "logoEmpty" };
  if (bytes.length > LOGO_MAX_BYTES) return { error: "logoTooBig" };
  const type = sniffLogoType(bytes);
  return type ? { type } : { error: "logoType" };
}

// /brand/logo-<ms>.<ext>: the timestamp changes with every upload, so the
// file can be cached for good; the extension lets proxy.ts serve it to
// visitors who are not signed in (the login page shows it).
export function logoPath(logo: StoredLogo): string {
  return `/brand/logo-${logo.updatedAt.getTime()}.${EXT[logo.type]}`;
}

export function parseLogoFile(file: string): { version: number } | null {
  const m = /^logo-(\d{1,15})\.(png|jpg|webp)$/.exec(file);
  return m ? { version: Number(m[1]) } : null;
}

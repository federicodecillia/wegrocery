import { DEFAULT_BRAND } from "./default";
import type { BrandConfig, BrandTheme } from "./types";

const STRING_FIELDS = [
  "appName", "shortName", "description", "orgName",
  "currency", "logoUrl", "supportEmail", "techEmail",
] as const;

const THEME_FIELDS = [
  "primary", "primaryLight", "accent", "accentLight", "background", "frame",
] as const;

function isHttpUrl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    const { protocol } = new URL(v);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function parseBrandConfig(raw: string | undefined): BrandConfig {
  if (!raw) return DEFAULT_BRAND;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`NEXT_PUBLIC_BRAND_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("NEXT_PUBLIC_BRAND_JSON must be a JSON object");
  }
  const o = json as Record<string, unknown>;

  for (const k of STRING_FIELDS) {
    if (o[k] !== undefined && typeof o[k] !== "string") {
      throw new Error(`brand.${k} must be a string`);
    }
  }
  if (o.locale !== undefined && o.locale !== "it" && o.locale !== "en") {
    throw new Error('brand.locale must be "it" or "en"');
  }
  if (o.archiveCcEmail !== undefined && o.archiveCcEmail !== null && typeof o.archiveCcEmail !== "string") {
    throw new Error("brand.archiveCcEmail must be a string or null");
  }
  if (o.headerShowName !== undefined && typeof o.headerShowName !== "boolean") {
    throw new Error("brand.headerShowName must be a boolean");
  }
  // Rendered as <a href> for logged-out visitors: absolute http(s) only
  // (in-app paths need a session; this also rules out javascript: URLs).
  for (const k of ["privacyUrl", "membershipUrl"] as const) {
    if (o[k] !== undefined && o[k] !== null && !isHttpUrl(o[k])) {
      throw new Error(`brand.${k} must be an absolute http(s) URL or null`);
    }
  }
  if (
    o.minBalance !== undefined &&
    o.minBalance !== null &&
    (typeof o.minBalance !== "number" || !Number.isFinite(o.minBalance))
  ) {
    throw new Error("brand.minBalance must be a finite number or null");
  }

  if (o.bankTransfer !== undefined && o.bankTransfer !== null) {
    const bt = o.bankTransfer as Record<string, unknown>;
    if (
      typeof bt !== "object" ||
      Array.isArray(bt) ||
      typeof bt.holder !== "string" ||
      !bt.holder.trim() ||
      typeof bt.iban !== "string" ||
      !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(bt.iban.replace(/\s+/g, ""))
    ) {
      throw new Error("brand.bankTransfer must be { holder, iban } with a valid IBAN, or null");
    }
  }

  let theme: BrandTheme = {};
  if (o.theme !== undefined) {
    if (typeof o.theme !== "object" || o.theme === null || Array.isArray(o.theme)) {
      throw new Error("brand.theme must be an object");
    }
    const t = o.theme as Record<string, unknown>;
    for (const k of THEME_FIELDS) {
      if (t[k] !== undefined && typeof t[k] !== "string") {
        throw new Error(`brand.theme.${k} must be a string`);
      }
    }
    theme = t as BrandTheme;
  }

  return { ...DEFAULT_BRAND, ...o, theme: { ...DEFAULT_BRAND.theme, ...theme } } as BrandConfig;
}

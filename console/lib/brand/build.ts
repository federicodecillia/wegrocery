import { mixHex, parseHex } from "./contrast";

// The initial NEXT_PUBLIC_BRAND_JSON of a new instance (fields as in the main
// app's docs/self-hosting.md). Only what the wizard knows; every other field
// falls back to WeGrocery's defaults, and the group refines it later in the
// app's own setup.

export interface BrandInput {
  appName: string;
  shortName: string;
  locale: "it" | "en";
  currency: string;
  primary?: string | null;
  accent?: string | null;
  logoUrl?: string | null;
  supportEmail?: string | null;
}

export interface BrandJson {
  appName: string;
  shortName: string;
  orgName: string;
  locale: "it" | "en";
  currency: string;
  logoUrl?: string;
  supportEmail?: string;
  techEmail?: string;
  theme?: Partial<Record<"primary" | "primaryLight" | "accent" | "accentLight", string>>;
}

export const SHORT_NAME_MAX = 12;

export function brandErrors(input: BrandInput): string[] {
  const errors: string[] = [];
  if (!input.appName.trim()) errors.push("Il nome dell'app è obbligatorio.");
  if (input.appName.length > 60) errors.push("Il nome dell'app può avere al massimo 60 caratteri.");
  if (!input.shortName.trim()) errors.push("Il nome breve è obbligatorio.");
  if (input.shortName.length > SHORT_NAME_MAX) errors.push(`Il nome breve può avere al massimo ${SHORT_NAME_MAX} caratteri.`);
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push("La valuta deve essere un codice ISO di 3 lettere (es. EUR).");
  for (const [k, v] of [["principale", input.primary], ["accento", input.accent]] as const) {
    if (v && !parseHex(v)) errors.push(`Il colore ${k} deve essere esadecimale, es. #237032.`);
  }
  if (input.logoUrl) {
    try {
      if (new URL(input.logoUrl).protocol !== "https:") errors.push("Il logo deve essere un URL https.");
    } catch {
      errors.push("L'URL del logo non è valido.");
    }
  }
  return errors;
}

export function buildBrandJson(input: BrandInput): BrandJson {
  const out: BrandJson = {
    appName: input.appName.trim(),
    shortName: input.shortName.trim(),
    orgName: input.appName.trim(),
    locale: input.locale,
    currency: input.currency,
  };
  if (input.logoUrl) out.logoUrl = input.logoUrl;
  if (input.supportEmail) {
    out.supportEmail = input.supportEmail;
    out.techEmail = input.supportEmail;
  }
  const theme: NonNullable<BrandJson["theme"]> = {};
  if (input.primary && parseHex(input.primary)) {
    theme.primary = input.primary.toLowerCase();
    theme.primaryLight = mixHex(input.primary, "#ffffff", 0.12);
  }
  if (input.accent && parseHex(input.accent)) {
    theme.accent = input.accent.toLowerCase();
    theme.accentLight = mixHex(input.accent, "#ffffff", 0.12);
  }
  if (Object.keys(theme).length) out.theme = theme;
  return out;
}

/** One line, as the env var wants it. */
export function brandJsonString(input: BrandInput): string {
  return JSON.stringify(buildBrandJson(input));
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz.includes("/") || tz === "UTC";
  } catch {
    return false;
  }
}

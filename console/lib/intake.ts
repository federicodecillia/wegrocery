import { isValidTimeZone } from "@/lib/brand/build";

// The public intake form (/richiesta): validation and limits, pure. The form
// never asks for a password, key or token, and the values are stored as text
// only after this check.

export interface IntakeData {
  groupName: string;
  contactName: string;
  contactEmail: string;
  city: string | null;
  membersEstimate: number | null;
  locale: "it" | "en";
  currency: string;
  timeZone: string;
  emailDomain: string | null;
  dnsManager: string | null;
  logoUrl: string | null;
  colors: string | null;
  onlinePayments: boolean;
  googleLogin: boolean;
  cardCheck: boolean;
  paymentMode: "wallet" | "per_order";
  hostingPreference: "managed" | "group_owned";
  notes: string | null;
}

export type IntakeResult =
  | { ok: true; data: IntakeData }
  | { ok: false; errors: Record<string, string>; spam?: boolean };

export const LIMITS = {
  groupName: 80,
  contactName: 80,
  contactEmail: 254,
  city: 80,
  emailDomain: 100,
  dnsManager: 120,
  logoUrl: 500,
  colors: 120,
  notes: 2000,
} as const;

/** Name of the hidden field bots fill in. */
export const HONEYPOT_FIELD = "website";

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_PATTERN = /^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

type Source = Record<string, string | undefined>;

export function validateIntake(src: Source): IntakeResult {
  if ((src[HONEYPOT_FIELD] ?? "").trim() !== "") return { ok: false, errors: {}, spam: true };

  const errors: Record<string, string> = {};
  const text = (key: keyof typeof LIMITS, required: boolean): string | null => {
    const v = (src[key] ?? "").trim();
    if (!v) {
      if (required) errors[key] = "Campo obbligatorio.";
      return null;
    }
    if (v.length > LIMITS[key]) errors[key] = `Al massimo ${LIMITS[key]} caratteri.`;
    return v;
  };
  const flag = (key: string) => src[key] === "on" || src[key] === "true" || src[key] === "si";

  const groupName = text("groupName", true);
  const contactName = text("contactName", true);
  const contactEmail = text("contactEmail", true);
  if (contactEmail && !errors.contactEmail && !EMAIL_PATTERN.test(contactEmail)) errors.contactEmail = "Indirizzo email non valido.";
  const city = text("city", false);
  const emailDomain = text("emailDomain", false)?.toLowerCase() ?? null;
  if (emailDomain && !errors.emailDomain && !DOMAIN_PATTERN.test(emailDomain)) errors.emailDomain = "Dominio non valido (es. gasriva.it).";
  const dnsManager = text("dnsManager", false);
  const logoUrl = text("logoUrl", false);
  if (logoUrl && !errors.logoUrl) {
    try {
      if (new URL(logoUrl).protocol !== "https:") errors.logoUrl = "Serve un indirizzo https.";
    } catch {
      errors.logoUrl = "Indirizzo non valido.";
    }
  }
  const colors = text("colors", false);
  const notes = text("notes", false);
  for (const [key, value] of Object.entries({ notes, colors, dnsManager, city })) {
    if (value && looksLikeSecret(value)) errors[key] = "Sembra una chiave o una password: toglila, non serve qui.";
  }

  let membersEstimate: number | null = null;
  const rawMembers = (src.membersEstimate ?? "").trim();
  if (rawMembers) {
    const n = Number(rawMembers);
    if (!Number.isInteger(n) || n < 1 || n > 100_000) errors.membersEstimate = "Un numero intero tra 1 e 100000.";
    else membersEstimate = n;
  }

  const locale = src.locale === "en" ? "en" : src.locale === "it" || !src.locale ? "it" : null;
  if (!locale) errors.locale = "Lingua non valida.";
  const currency = (src.currency ?? "EUR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Codice ISO di 3 lettere, es. EUR.";
  const timeZone = (src.timeZone ?? "Europe/Rome").trim();
  if (!isValidTimeZone(timeZone)) errors.timeZone = "Fuso orario non valido (es. Europe/Rome).";
  const paymentMode = src.paymentMode === "per_order" ? "per_order" : "wallet";
  const hostingPreference = src.hostingPreference === "group_owned" ? "group_owned" : "managed";
  if (!flag("privacy")) errors.privacy = "Serve il consenso al trattamento dei dati.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      groupName: groupName!,
      contactName: contactName!,
      contactEmail: contactEmail!.toLowerCase(),
      city,
      membersEstimate,
      locale: locale!,
      currency,
      timeZone,
      emailDomain,
      dnsManager,
      logoUrl,
      colors,
      onlinePayments: flag("onlinePayments"),
      googleLogin: flag("googleLogin"),
      cardCheck: flag("cardCheck"),
      paymentMode,
      hostingPreference,
      notes,
    },
  };
}

/** Looks like something that must never be pasted into the form. */
export function looksLikeSecret(value: string): boolean {
  return /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}|\bre_[A-Za-z0-9]{16,}|\bwhsec_[A-Za-z0-9]{8,}|postgres(ql)?:\/\/[^\s]+:[^\s]+@/.test(value);
}

// The bank transfer reference ("causale") a member writes when paying an
// order by bank transfer, filled in for each order from a template the admins
// set in Impostazioni (app_settings.bank_reference_template, drizzle/
// 0033_bank_reference.sql), plus where to send the transfer receipt. Pure, so
// it is unit tested.

// SEPA allows 140 characters of unstructured remittance information: a filled
// reference is cut there, a template longer than that is refused.
export const BANK_REFERENCE_MAX = 140;
export const RECEIPT_EMAIL_MAX = 254;

export type BankReferenceValues = {
  order: string; // the cycle's title
  month: string; // written out, in the group's language ("ottobre")
  year: string;
  member: string; // the full name of who pays
};

// Each placeholder in Italian and English, whatever the group's language.
const PLACEHOLDERS: Record<string, keyof BankReferenceValues> = {
  ordine: "order",
  order: "order",
  mese: "month",
  month: "month",
  anno: "year",
  year: "year",
  socio: "member",
  member: "member",
};

const PLACEHOLDER_RE = /\{\s*([^{}\s]+)\s*\}/g;

// The template as stored: one line, single spaces, null when empty.
export function normalizeBankReferenceTemplate(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

export type BankReferenceTemplateError = "tooLong" | "unknownPlaceholder";

export function checkBankReferenceTemplate(template: string): BankReferenceTemplateError | null {
  if (template.length > BANK_REFERENCE_MAX) return "tooLong";
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    if (!(match[1].toLowerCase() in PLACEHOLDERS)) return "unknownPlaceholder";
  }
  return null;
}

export function fillBankReference(template: string, values: BankReferenceValues): string {
  const filled = template
    .replace(PLACEHOLDER_RE, (whole, name: string) => {
      const key = PLACEHOLDERS[name.toLowerCase()];
      return key ? values[key] : whole;
    })
    .replace(/\s+/g, " ")
    .trim();
  return filled.slice(0, BANK_REFERENCE_MAX).trim();
}

// Month and year of the order: when its orders closed, else when the cycle
// was created, in the group's zone and language.
export function referenceMonthYear(
  date: Date,
  locale: string,
  timeZone: string,
): { month: string; year: string } {
  return {
    month: date.toLocaleDateString(locale, { month: "long", timeZone }),
    year: date.toLocaleDateString(locale, { year: "numeric", timeZone }),
  };
}

// A deliberately loose shape check: one @, a dot in the domain, no spaces.
export function isValidReceiptEmail(email: string): boolean {
  return email.length <= RECEIPT_EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// The orders a member pays by bank transfer: closed wallet cycles, or any
// closed cycle for a member who pays outside the app. A card cycle is paid
// with Stripe.
export function paidByBankTransfer(
  cycle: { status: string; paymentMode: string },
  paysOffline: boolean,
): boolean {
  return cycle.status === "closed" && (cycle.paymentMode !== "per_order" || paysOffline);
}

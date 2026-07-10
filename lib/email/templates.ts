import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { formatMoney, formatDateTime } from "@/lib/i18n/format";
import { getAppBaseUrl } from "./base-url";

type SupplierEmailInput = {
  cycleTitle: string;
  pickupDate: Date | null;
  grandTotal: number;
  productCount: number;
  memberCount: number;
};

const formatPickup = (d: Date): string =>
  formatDateTime(d, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export function supplierOrderEmail(input: SupplierEmailInput): {
  subject: string;
  text: string;
} {
  const { cycleTitle, pickupDate, grandTotal, productCount, memberCount } = input;
  const subject = t.email.supplierOrderSubject(brand.appName, cycleTitle);
  const pickupStr = pickupDate ? formatPickup(pickupDate) : null;
  const grandTotalStr = formatMoney(grandTotal);
  const text = t.email.supplierOrderBody({
    appName: brand.appName,
    orgName: brand.orgName,
    cycleTitle,
    pickupDate: pickupStr,
    grandTotal: grandTotalStr,
    productCount,
    memberCount,
  });
  return { subject, text };
}

// Generic member-facing notification email. Reuses the already-localized
// title/body of the in-app notification so there is a single source of copy;
// appends a CTA to the relevant page and a manage-preferences link when a base
// URL is configured, then the org signature. Links are omitted (not broken)
// when no base URL is available.
export function notificationEmail(input: {
  title: string;
  body: string;
  href?: string | null;
}): { subject: string; text: string } {
  const baseUrl = getAppBaseUrl();
  const subject = t.email.notificationSubject(brand.appName, input.title);

  const lines: string[] = [input.body, ""];
  if (baseUrl && input.href) {
    lines.push(t.email.notificationCta(`${baseUrl}${input.href}`), "");
  }
  if (baseUrl) {
    lines.push(t.email.notificationManagePrefs(`${baseUrl}/notifiche/impostazioni`), "");
  }
  lines.push(t.email.notificationFooter(brand.orgName));

  return { subject, text: lines.join("\n") };
}

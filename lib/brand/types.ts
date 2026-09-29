export type BrandTheme = {
  /** maps to --orange (primary CTA color) */
  primary?: string;
  /** maps to --orange-l */
  primaryLight?: string;
  /** maps to --teal (accent) */
  accent?: string;
  /** maps to --teal-l */
  accentLight?: string;
  /** maps to --background and --warm-wh */
  background?: string;
  /** maps to --frame (page frame behind the card) */
  frame?: string;
};

export type BrandConfig = {
  appName: string;
  shortName: string;
  description: string;
  /** legal/organization name used in email signatures */
  orgName: string;
  locale: "it" | "en";
  /** ISO 4217, e.g. "EUR" */
  currency: string;
  /** absolute URL or path under public/ */
  logoUrl: string;
  supportEmail: string;
  techEmail: string;
  /** CC address on supplier order emails; null = no CC */
  archiveCcEmail: string | null;
  /**
   * Show the app name next to the logo in the header.
   * true for square icon logos (WeGrocery default); false when the logo is a
   * wordmark that already contains the name.
   */
  headerShowName: boolean;
  /**
   * Privacy notice URL, linked from the login page and the app shell; null = no
   * link. Use an absolute URL: every in-app path except /login requires a
   * session (middleware.ts), so a logged-out visitor could not open it.
   */
  privacyUrl: string | null;
  /** Membership / renewal page shown when the membership check fails; null = no link */
  membershipUrl: string | null;
  /**
   * Credit limit: the lowest balance a member may reach after subtracting
   * pending open orders and the order being saved (e.g. -50). null = no limit.
   * Only a default: once an admin saves the payment settings (Impostazioni,
   * app_settings) those win, see lib/payments/settings.ts.
   */
  minBalance: number | null;
  /**
   * Bank details shown on /ricarica for top-ups by bank transfer; null = the
   * page tells members to ask the treasurer. Public (NEXT_PUBLIC_*): an IBAN
   * is meant to be shared with members.
   * Only a default: once an admin saves the payment settings (Impostazioni,
   * app_settings) those win, see lib/payments/settings.ts.
   */
  bankTransfer: { holder: string; iban: string } | null;
  theme: BrandTheme;
};

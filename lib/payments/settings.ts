// Payment settings: what the admins chose in Impostazioni (app_settings,
// drizzle/0019), else the brand defaults, combined with this deploy's Stripe
// key. Pure (no env reads, no I/O) so it is unit tested;
// lib/payments/get-settings.ts reads the row.

import type { BrandConfig } from "@/lib/brand/types";
import type { StripeKeyStatus } from "./config";

export type PaymentMode = "wallet" | "per_order";

// A row of app_settings as Drizzle returns it: numeric columns are strings.
export type PaymentSettingsRow = {
  paymentMode: string;
  minBalance: string | null;
  maxBalance: string | null;
  bankTransferEnabled: boolean;
  bankHolder: string | null;
  bankIban: string | null;
  onlinePaymentsEnabled: boolean;
  // Optional: rows read before migration 0029 have no such column.
  familiesEnabled?: boolean;
  updatedAt: Date;
};

// The Stripe key as the app may show it: whether it works on this deploy and
// in which mode, never the key itself.
export type StripeKeyState =
  | { usable: true; livemode: boolean }
  | { usable: false; reason: "missing" | "liveKeyOutsideProduction" | "testKeyInProduction" };

export type PaymentSettings = {
  // Always "wallet" until pay-per-order ships (B2).
  mode: PaymentMode;
  // Euros: the credit limit (<= 0) and the highest balance an online top-up
  // may reach (>= 0); null = no limit.
  minBalance: number | null;
  maxBalance: number | null;
  // As stored, so the admin form shows them while a channel is off.
  bankTransferEnabled: boolean;
  bankHolder: string | null;
  bankIban: string | null;
  onlinePaymentsEnabled: boolean;
  // Members may invite each other into one account (lib/members/family.ts).
  familiesEnabled: boolean;
  // What members get: the bank details when that channel is on, online
  // top-ups when switched on and the deploy has a usable key.
  bankTransfer: { holder: string; iban: string } | null;
  onlineTopupAvailable: boolean;
  stripeKey: StripeKeyState;
  // null until an admin saves: the values above are the defaults.
  savedAt: Date | null;
};

type StoredSettings = Omit<PaymentSettings, "bankTransfer" | "onlineTopupAvailable" | "stripeKey">;

// Without a row: the brand's credit limit and bank details, no maximum and
// Stripe on (it still needs a key), i.e. how the app worked before B1.
export function resolvePaymentSettings(
  row: PaymentSettingsRow | null,
  brand: Pick<BrandConfig, "minBalance" | "bankTransfer">,
  keyStatus: StripeKeyStatus,
): PaymentSettings {
  const stored: StoredSettings = row
    ? {
        mode: row.paymentMode === "per_order" ? "per_order" : "wallet",
        minBalance: row.minBalance === null ? null : Number(row.minBalance),
        maxBalance: row.maxBalance === null ? null : Number(row.maxBalance),
        bankTransferEnabled: row.bankTransferEnabled,
        bankHolder: row.bankHolder,
        bankIban: row.bankIban,
        onlinePaymentsEnabled: row.onlinePaymentsEnabled,
        familiesEnabled: row.familiesEnabled ?? false,
        savedAt: row.updatedAt,
      }
    : {
        mode: "wallet",
        minBalance: brand.minBalance,
        maxBalance: null,
        bankTransferEnabled: brand.bankTransfer !== null,
        bankHolder: brand.bankTransfer?.holder ?? null,
        bankIban: brand.bankTransfer?.iban ?? null,
        onlinePaymentsEnabled: true,
        familiesEnabled: false,
        savedAt: null,
      };
  const stripeKey: StripeKeyState = keyStatus.enabled
    ? { usable: true, livemode: keyStatus.livemode }
    : { usable: false, reason: keyStatus.reason };
  return {
    ...stored,
    bankTransfer:
      stored.bankTransferEnabled && stored.bankHolder && stored.bankIban
        ? { holder: stored.bankHolder, iban: stored.bankIban }
        : null,
    onlineTopupAvailable: stored.onlinePaymentsEnabled && stripeKey.usable,
    stripeKey,
  };
}

// The Impostazioni form as typed: amounts are strings, "" = no limit. The
// minimum is asked as a positive overdraft ("50" = the balance may go down to
// -50 €), which admins read more easily than a negative number.
export type PaymentSettingsInput = {
  maxOverdraft: string;
  maxBalance: string;
  bankTransferEnabled: boolean;
  bankHolder: string;
  bankIban: string;
  onlinePaymentsEnabled: boolean;
};

export type PaymentSettingsError =
  | "overdraftInvalid"
  | "maxBalanceInvalid"
  | "bankHolderRequired"
  | "bankHolderTooLong"
  | "ibanInvalid"
  | "noChannel";

// app_settings columns ready to write: numeric as strings, blanks as NULL.
export type PaymentSettingsValues = {
  minBalance: string | null;
  maxBalance: string | null;
  bankTransferEnabled: boolean;
  bankHolder: string | null;
  bankIban: string | null;
  onlinePaymentsEnabled: boolean;
};

// A typo guard, far above any real balance: 10.000 €.
export const BALANCE_LIMIT_MAX_CENTS = 1_000_000;
const BANK_HOLDER_MAX_LENGTH = 100;

// "50", "12,5", "12.50" -> cents; null for a blank; "invalid" for a sign, a
// thousands separator, more than two decimals or more than the guard.
function parseLimitCents(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(trimmed)) return "invalid";
  const [whole, frac = ""] = trimmed.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents > BALANCE_LIMIT_MAX_CENTS ? "invalid" : cents;
}

export function compactIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

// Same shape check as brand.bankTransfer (lib/brand/parse.ts).
export function isValidIban(iban: string): boolean {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compactIban(iban));
}

export function planPaymentSettingsUpdate(
  input: PaymentSettingsInput,
  stripeKey: StripeKeyState,
): { values: PaymentSettingsValues } | { error: PaymentSettingsError } {
  const overdraft = parseLimitCents(input.maxOverdraft);
  if (overdraft === "invalid") return { error: "overdraftInvalid" };
  const max = parseLimitCents(input.maxBalance);
  if (max === "invalid") return { error: "maxBalanceInvalid" };

  const holder = input.bankHolder.trim();
  const iban = compactIban(input.bankIban);
  if (holder.length > BANK_HOLDER_MAX_LENGTH) return { error: "bankHolderTooLong" };
  // A switched-off channel keeps its details for later, but never a broken IBAN.
  if (iban !== "" && !isValidIban(iban)) return { error: "ibanInvalid" };
  if (input.bankTransferEnabled && holder === "") return { error: "bankHolderRequired" };
  if (input.bankTransferEnabled && iban === "") return { error: "ibanInvalid" };
  // Members need a way to top up: the bank details, or Stripe with a key that
  // works on this deploy.
  if (!input.bankTransferEnabled && !(input.onlinePaymentsEnabled && stripeKey.usable)) {
    return { error: "noChannel" };
  }

  return {
    values: {
      minBalance: overdraft === null ? null : (-overdraft / 100).toFixed(2),
      maxBalance: max === null ? null : (max / 100).toFixed(2),
      bankTransferEnabled: input.bankTransferEnabled,
      bankHolder: holder === "" ? null : holder,
      bankIban: iban === "" ? null : iban,
      onlinePaymentsEnabled: input.onlinePaymentsEnabled,
    },
  };
}

// Above the group's maximum balance, compared in cents; never without one.
export function isAboveMaxBalance(balance: number, maxBalance: number | null): boolean {
  return maxBalance !== null && Math.round(balance * 100) > Math.round(maxBalance * 100);
}

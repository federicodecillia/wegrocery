import { describe, expect, it } from "vitest";
import type { StripeKeyStatus } from "./config";
import {
  isAboveMaxBalance,
  planPaymentSettingsUpdate,
  resolvePaymentSettings,
  type PaymentSettingsInput,
  type PaymentSettingsRow,
} from "./settings";

const IBAN = "IT60X0542811101000000123456";
const SPACED_IBAN = "IT60 X054 2811 1010 0000 0123 456";
const brand = { minBalance: -50, bankTransfer: { holder: "Porta Moneta APS", iban: SPACED_IBAN } };
const testKey: StripeKeyStatus = { enabled: true, secretKey: "sk_test_secret", livemode: false };
const noKey: StripeKeyStatus = { enabled: false, reason: "missing" };

const row: PaymentSettingsRow = {
  paymentMode: "wallet",
  minBalance: "-30.00",
  maxBalance: "0.00",
  bankTransferEnabled: true,
  bankHolder: "Tesoriere",
  bankIban: IBAN,
  onlinePaymentsEnabled: true,
  updatedAt: new Date("2026-10-01T10:00:00Z"),
};

describe("resolvePaymentSettings", () => {
  it("falls back to the brand while no admin has saved", () => {
    expect(resolvePaymentSettings(null, brand, testKey)).toEqual({
      mode: "wallet",
      minBalance: -50,
      maxBalance: null,
      bankTransferEnabled: true,
      bankHolder: "Porta Moneta APS",
      bankIban: SPACED_IBAN,
      onlinePaymentsEnabled: true,
      familiesEnabled: false,
      bankTransfer: { holder: "Porta Moneta APS", iban: SPACED_IBAN },
      onlineTopupAvailable: true,
      stripeKey: { usable: true, livemode: false },
      savedAt: null,
    });
  });

  it("has no bank channel by default when the brand has no bank details", () => {
    const s = resolvePaymentSettings(null, { minBalance: null, bankTransfer: null }, testKey);
    expect(s.bankTransferEnabled).toBe(false);
    expect(s.bankTransfer).toBeNull();
    expect(s.minBalance).toBeNull();
  });

  it("uses the saved row over the brand", () => {
    const s = resolvePaymentSettings(row, brand, testKey);
    expect(s.minBalance).toBe(-30);
    expect(s.maxBalance).toBe(0);
    expect(s.bankTransfer).toEqual({ holder: "Tesoriere", iban: IBAN });
    expect(s.savedAt).toEqual(row.updatedAt);
  });

  it("keeps the details of a bank channel switched off, without offering them", () => {
    const s = resolvePaymentSettings({ ...row, bankTransferEnabled: false }, brand, testKey);
    expect(s.bankTransfer).toBeNull();
    expect(s.bankIban).toBe(IBAN);
  });

  it("offers online top-ups only when switched on and the key works here", () => {
    const s = resolvePaymentSettings(row, brand, noKey);
    expect(s.onlinePaymentsEnabled).toBe(true);
    expect(s.onlineTopupAvailable).toBe(false);
    expect(s.stripeKey).toEqual({ usable: false, reason: "missing" });
    const off = resolvePaymentSettings({ ...row, onlinePaymentsEnabled: false }, brand, testKey);
    expect(off.onlineTopupAvailable).toBe(false);
  });

  it("never carries the secret key", () => {
    expect(JSON.stringify(resolvePaymentSettings(row, brand, testKey))).not.toContain("sk_test_secret");
  });
});

const input: PaymentSettingsInput = {
  maxOverdraft: "50",
  maxBalance: "300",
  bankTransferEnabled: true,
  bankHolder: " Porta Moneta APS ",
  bankIban: "it60 x054 2811 1010 0000 0123 456",
  onlinePaymentsEnabled: true,
};
const usable = { usable: true, livemode: false } as const;
const missing = { usable: false, reason: "missing" } as const;

describe("planPaymentSettingsUpdate", () => {
  it("stores the overdraft as a negative minimum and the IBAN compact, upper case", () => {
    expect(planPaymentSettingsUpdate(input, usable)).toEqual({
      values: {
        minBalance: "-50.00",
        maxBalance: "300.00",
        bankTransferEnabled: true,
        bankHolder: "Porta Moneta APS",
        bankIban: IBAN,
        onlinePaymentsEnabled: true,
      },
    });
  });

  it("reads Italian decimals, zero and blanks", () => {
    expect(planPaymentSettingsUpdate({ ...input, maxOverdraft: "0", maxBalance: "12,5" }, usable)).toMatchObject({
      values: { minBalance: "0.00", maxBalance: "12.50" },
    });
    expect(planPaymentSettingsUpdate({ ...input, maxOverdraft: " ", maxBalance: "" }, usable)).toMatchObject({
      values: { minBalance: null, maxBalance: null },
    });
    expect(planPaymentSettingsUpdate({ ...input, maxBalance: "10000" }, usable)).toMatchObject({
      values: { maxBalance: "10000.00" },
    });
  });

  it("refuses limits it would have to guess", () => {
    for (const bad of ["-50", "50€", "1.000", "abc", "10000,01"]) {
      expect(planPaymentSettingsUpdate({ ...input, maxOverdraft: bad }, usable)).toEqual({ error: "overdraftInvalid" });
      expect(planPaymentSettingsUpdate({ ...input, maxBalance: bad }, usable)).toEqual({ error: "maxBalanceInvalid" });
    }
  });

  it("needs holder and IBAN to switch the bank transfer on", () => {
    expect(planPaymentSettingsUpdate({ ...input, bankHolder: "  " }, usable)).toEqual({ error: "bankHolderRequired" });
    expect(planPaymentSettingsUpdate({ ...input, bankIban: "" }, usable)).toEqual({ error: "ibanInvalid" });
    expect(planPaymentSettingsUpdate({ ...input, bankIban: "IT60 123" }, usable)).toEqual({ error: "ibanInvalid" });
    expect(planPaymentSettingsUpdate({ ...input, bankHolder: "x".repeat(101) }, usable)).toEqual({
      error: "bankHolderTooLong",
    });
  });

  it("keeps the details of a switched-off bank channel, but never an invalid IBAN", () => {
    expect(planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false }, usable)).toMatchObject({
      values: { bankTransferEnabled: false, bankIban: IBAN },
    });
    expect(planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false, bankIban: "nope" }, usable)).toEqual({
      error: "ibanInvalid",
    });
    expect(
      planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false, bankHolder: "", bankIban: "" }, usable),
    ).toMatchObject({ values: { bankHolder: null, bankIban: null } });
  });

  it("needs at least one channel members can use", () => {
    expect(planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false }, usable)).toHaveProperty("values");
    expect(planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false }, missing)).toEqual({ error: "noChannel" });
    expect(
      planPaymentSettingsUpdate({ ...input, bankTransferEnabled: false, onlinePaymentsEnabled: false }, usable),
    ).toEqual({ error: "noChannel" });
    expect(planPaymentSettingsUpdate({ ...input, onlinePaymentsEnabled: false }, missing)).toHaveProperty("values");
  });
});

describe("isAboveMaxBalance", () => {
  it("compares in cents, and is never true without a maximum", () => {
    expect(isAboveMaxBalance(300.01, 300)).toBe(true);
    expect(isAboveMaxBalance(300, 300)).toBe(false);
    expect(isAboveMaxBalance(0.1 + 0.2, 0.3)).toBe(false);
    expect(isAboveMaxBalance(1_000_000, null)).toBe(false);
  });
});

describe("planPaymentSettingsUpdate, holder length", () => {
  it("accepts a holder of exactly 100 characters", () => {
    expect(planPaymentSettingsUpdate({ ...input, bankHolder: "x".repeat(100) }, usable)).toHaveProperty("values");
  });
});

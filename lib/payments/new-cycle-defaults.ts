import type { PaymentMode } from "./settings";
import {
  HANDLING_FEE_MAX,
  NO_HANDLING_FEE,
  WEIGHING_DEPOSIT_MAX,
  parseHandlingFee,
  parseWeighingDeposit,
  type HandlingFee,
} from "./order-payment";

// What "Nuovo ciclo" starts from (drizzle/0043_new_cycle_defaults.sql): per
// payment mode, the shipping and the preparation fee the admins chose in
// Impostazioni. The form shows them and the admin may change them; the cycle
// stores what was sent, so changing a default never touches a cycle already
// created. Anything not set falls back to how new cycles started before: the
// last fee of the same mode (10% by card), shipping empty. Pure.

export type ShippingDefault = { mode: "fixed_per_member" | "proportional"; amount: number | null };
// "none" is stored for wallet cycles; a card cycle always has a fee
// (drizzle/0021), so its "none" is stored as 0% (NO_HANDLING_FEE).
export type FeeDefault = { type: "none" } | HandlingFee;
// depositPct: the weighing deposit of a new card cycle (drizzle/0045), card
// cycles only; absent = none.
export type ModeDefaults = { shipping?: ShippingDefault; fee?: FeeDefault; depositPct?: number };
export type NewCycleDefaults = Partial<Record<PaymentMode, ModeDefaults>>;

// The largest shipping amount a default may carry, per member or in total.
export const SHIPPING_DEFAULT_MAX = 100_000;

const isMode = (v: unknown): v is PaymentMode => v === "wallet" || v === "per_order";

// The stored jsonb, read defensively: whatever does not fit is left out.
export function parseNewCycleDefaults(raw: unknown): NewCycleDefaults {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NewCycleDefaults = {};
  for (const [mode, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMode(mode) || !value || typeof value !== "object") continue;
    const v = value as { shipping?: unknown; fee?: unknown; depositPct?: unknown };
    const entry: ModeDefaults = {};
    const shipping = readShipping(v.shipping);
    if (shipping) entry.shipping = shipping;
    const fee = readFee(v.fee, mode);
    if (fee) entry.fee = fee;
    const depositPct = mode === "per_order" ? readDeposit(v.depositPct) : null;
    if (depositPct !== null) entry.depositPct = depositPct;
    if (entry.shipping || entry.fee || entry.depositPct !== undefined) out[mode] = entry;
  }
  return out;
}

function readShipping(raw: unknown): ShippingDefault | null {
  if (!raw || typeof raw !== "object") return null;
  const { mode, amount } = raw as { mode?: unknown; amount?: unknown };
  if (mode !== "fixed_per_member" && mode !== "proportional") return null;
  if (amount === null) return { mode, amount: null };
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > SHIPPING_DEFAULT_MAX) return null;
  return { mode, amount };
}

function readDeposit(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0 || raw > WEIGHING_DEPOSIT_MAX) return null;
  return raw;
}

function readFee(raw: unknown, mode: PaymentMode): FeeDefault | null {
  if (!raw || typeof raw !== "object") return null;
  const { type, value } = raw as { type?: unknown; value?: unknown };
  if (type === "none") return mode === "wallet" ? { type: "none" } : null;
  if ((type !== "percent" && type !== "fixed") || typeof value !== "number") return null;
  if (!Number.isFinite(value) || value < 0 || value > HANDLING_FEE_MAX[type]) return null;
  return { type, value };
}

// The Impostazioni form as typed, per mode: amounts are strings ("" = not set).
export type ModeDefaultsInput = {
  shippingMode: "fixed_per_member" | "proportional";
  shippingAmount: string;
  feeType: "none" | "percent" | "fixed";
  feeValue: string;
  // Card cycles only: the weighing deposit, "" = none. Left out: unchanged.
  depositPct?: string;
};

export type DefaultsError = { mode: PaymentMode; field: "shipping" | "fee" | "deposit" };

// "0", "2,5", "1.50": at most two decimals, no sign.
function parseAmount(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(trimmed)) return "invalid";
  const n = Number(trimmed.replace(",", "."));
  return n > SHIPPING_DEFAULT_MAX ? "invalid" : n;
}

// What the form sent, checked, as it is stored. A mode left out keeps its
// stored defaults; an empty shipping amount is stored as "no amount" (the
// form starts empty), an empty fee value as "not set" (the last fee again).
export function planNewCycleDefaults(
  current: NewCycleDefaults,
  input: Partial<Record<PaymentMode, ModeDefaultsInput>>,
): { defaults: NewCycleDefaults } | { error: DefaultsError } {
  const next: NewCycleDefaults = { ...current };
  for (const mode of ["wallet", "per_order"] as const) {
    const i = input[mode];
    if (!i) continue;
    if (i.shippingMode !== "fixed_per_member" && i.shippingMode !== "proportional") {
      return { error: { mode, field: "shipping" } };
    }
    const amount = parseAmount(i.shippingAmount);
    if (amount === "invalid") return { error: { mode, field: "shipping" } };
    const entry: ModeDefaults = { shipping: { mode: i.shippingMode, amount } };
    if (i.feeType === "none") {
      entry.fee = mode === "wallet" ? { type: "none" } : NO_HANDLING_FEE;
    } else if (i.feeValue.trim() !== "") {
      const fee = parseHandlingFee(i.feeType, i.feeValue);
      if ("error" in fee) return { error: { mode, field: "fee" } };
      entry.fee = fee;
    }
    if (mode === "per_order") {
      if (i.depositPct === undefined) {
        if (current.per_order?.depositPct !== undefined) entry.depositPct = current.per_order.depositPct;
      } else {
        const deposit = parseWeighingDeposit(i.depositPct);
        if ("error" in deposit) return { error: { mode, field: "deposit" } };
        if (deposit.pct !== null) entry.depositPct = deposit.pct;
      }
    }
    next[mode] = entry;
  }
  return { defaults: next };
}

// The fee a new cycle of this mode starts from: the default, else the last
// one of that mode (lib/payments/order-payment.ts, resolveCycleFee, adds 10%
// by card when there is neither).
export function startingFee(defaults: NewCycleDefaults, mode: PaymentMode, lastFee: HandlingFee | null): HandlingFee | null {
  const fee = defaults[mode]?.fee;
  if (fee) return fee.type === "none" ? null : fee;
  return lastFee;
}

// The three ways a wallet group can pay its new cycles, as Impostazioni
// offers them: card_cycles_enabled with new_cycle_payment_mode.
export type NewCyclePaymentChoice = "wallet_only" | "wallet_default" | "card_default";

export function newCyclePaymentChoice(cardCyclesEnabled: boolean, newCycleMode: PaymentMode | null): NewCyclePaymentChoice {
  if (!cardCyclesEnabled) return "wallet_only";
  return newCycleMode === "per_order" ? "card_default" : "wallet_default";
}

export function newCyclePaymentColumns(choice: NewCyclePaymentChoice): {
  cardCyclesEnabled: boolean;
  newCyclePaymentMode: PaymentMode | null;
} {
  if (choice === "wallet_only") return { cardCyclesEnabled: false, newCyclePaymentMode: null };
  if (choice === "wallet_default") return { cardCyclesEnabled: true, newCyclePaymentMode: null };
  return { cardCyclesEnabled: true, newCyclePaymentMode: "per_order" };
}

export function isNewCyclePaymentChoice(v: unknown): v is NewCyclePaymentChoice {
  return v === "wallet_only" || v === "wallet_default" || v === "card_default";
}

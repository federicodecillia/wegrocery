// Pure rules for admin edits to ledger entries, extracted so they can be unit
// tested ("use server" modules can only export async functions).

// Charges written by the system at cycle close (order, shipping, order
// preparation fee) and by the shipping recompute / distinta import. An admin
// fixes them with a new `correction` entry, never by editing or deleting the
// row: the original charge is the reference every later correction is
// computed against.
const SYSTEM_CHARGE_TYPES = new Set(["order_charge", "shipping_charge", "handling_charge"]);

export function isAdminEditableLedgerType(type: string): boolean {
  return !SYSTEM_CHARGE_TYPES.has(type);
}

export type LedgerAmountError = "notEditable" | "notFinite" | "zero" | "signChange" | "notPositive";

function toCents(n: number): number {
  return Math.round(n * 100);
}

// Sign of a stored amount, or 0 when it has none: a zero row, or a legacy
// NaN row written by the old empty-amount bug (0012 blocks new ones).
function storedSign(amount: string): number {
  const cents = toCents(parseFloat(amount));
  return Number.isFinite(cents) ? Math.sign(cents) : 0;
}

// The Cassa editor shows the absolute value; this puts the entry's own sign
// back on what the admin typed. A refund (+8) whose note is edited stays +8.
// An entry with no sign (0 or legacy NaN) takes what the admin typed
// literally ("-3" is a charge, "3" a credit), so it can still be repaired
// from the UI. Unparseable input returns NaN so the server-side validation
// rejects it with a readable message.
export function applyOriginalSign(originalAmount: string, input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const typed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(typed)) return NaN;
  const sign = storedSign(originalAmount);
  return sign !== 0 ? sign * Math.abs(typed) : typed;
}

export function validateLedgerEntryEdit(
  entry: { type: string; amount: string },
  newAmount: number,
): LedgerAmountError | null {
  if (!isAdminEditableLedgerType(entry.type)) return "notEditable";
  if (!Number.isFinite(newAmount)) return "notFinite";
  const newCents = toCents(newAmount);
  if (newCents === 0) return "zero";
  const originalSign = storedSign(entry.amount);
  // No UI flips a sign on purpose: a sign change is always the old
  // recompute-from-type bug or a typo, and it moves twice the amount.
  if (originalSign !== 0 && originalSign !== Math.sign(newCents)) return "signChange";
  // A sign-less (0 / legacy NaN) topup takes the typed sign: keep it positive.
  if (entry.type === "topup" && newCents < 0) return "notPositive";
  return null;
}

export function validateTopupAmount(amount: number): LedgerAmountError | null {
  if (!Number.isFinite(amount)) return "notFinite";
  const cents = toCents(amount);
  if (cents === 0) return "zero";
  if (cents < 0) return "notPositive";
  return null;
}

// ── Manual Cassa movements ────────────────────────────────────────────────────

// How the money of a manual movement moved (ledger_entries.method, CHECK in
// drizzle/0018). Online top-ups are not here: only the Stripe webhook credits
// them, their method stays NULL and payment_id identifies them.
export const MANUAL_PAYMENT_METHODS = ["bonifico", "contanti", "satispay", "altro"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

// Money leaving a member's balance by hand, all stored negative: `payout`
// returns (part of) the balance to the member, `manual_charge` and
// `membership_fee` debit it. Other code maps these names (Storico labels), so
// they are part of the data model.
export const OUTGOING_LEDGER_TYPES = ["payout", "manual_charge", "membership_fee"] as const;
export type OutgoingLedgerType = (typeof OUTGOING_LEDGER_TYPES)[number];

export type ManualLedgerType = "topup" | OutgoingLedgerType;

export function isOutgoingLedgerType(type: string): type is OutgoingLedgerType {
  return (OUTGOING_LEDGER_TYPES as readonly string[]).includes(type);
}

// Bank references (CRO/TRN) are 11-35 characters; the cap only stops pastes
// of whole statement lines.
export const EXTERNAL_REF_MAX_LENGTH = 100;
// Unique on upper(trim(external_ref)): the same transfer cannot be recorded
// twice (drizzle/0018).
export const EXTERNAL_REF_UNIQUE_INDEX = "ledger_entries_external_ref_uniq";

export type ManualMovementError =
  | LedgerAmountError
  | "invalidType"
  | "invalidMethod"
  | "refTooLong"
  | "noteRequired"
  | "invalidDate";

export type ManualMovementInput = {
  type: string;
  // What the admin typed: always positive, the type decides the sign.
  amount: number;
  method?: string | null;
  externalRef?: string | null;
  note?: string | null;
  // "YYYY-MM-DD" from the date input; blank = now.
  entryDate?: string | null;
};

export type ManualMovementPlan = {
  type: ManualLedgerType;
  // Signed numeric(10,2) string, rounded to the cents that were validated.
  amount: string;
  // Absolute amount in cents, for balance and duplicate checks.
  amountCents: number;
  method: ManualPaymentMethod | null;
  externalRef: string | null;
  note: string | null;
  entryDate: Date;
};

// What an amount field holds, as a number: Italian admins type decimal
// commas. Blank or garbage is NaN, never 0, so it fails validation as invalid.
export function parseAmountInput(input: string): number {
  const trimmed = input.trim();
  return trimmed === "" ? NaN : Number(trimmed.replace(",", "."));
}

function isManualPaymentMethod(value: unknown): value is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHODS as readonly unknown[]).includes(value);
}

// A date input's "YYYY-MM-DD", as UTC midnight like the rest of the Cassa
// dates; null for any other format or a day that does not exist (02-30).
function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? date : null;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

// Validates and normalises a movement typed in the Cassa forms. The server
// action runs it on the raw payload, so nothing from the client is written
// unchecked. Top-ups need a method; a payout may name one; charges and fees
// move no money, so a method or reference sent for them is dropped. Outgoing
// movements need a causale, which the member sees.
export function planManualMovement(
  input: ManualMovementInput,
  now: Date,
): { plan: ManualMovementPlan } | { error: ManualMovementError } {
  const type = input.type;
  if (type !== "topup" && !isOutgoingLedgerType(type)) return { error: "invalidType" };

  const amountError = validateTopupAmount(input.amount);
  if (amountError) return { error: amountError };
  const amountCents = toCents(input.amount);

  const movesMoney = type === "topup" || type === "payout";
  let method: ManualPaymentMethod | null = null;
  if (type === "topup" || (type === "payout" && blankToNull(input.method) !== null)) {
    if (!isManualPaymentMethod(input.method)) return { error: "invalidMethod" };
    method = input.method;
  }

  const externalRef = movesMoney ? blankToNull(input.externalRef) : null;
  if (externalRef !== null && externalRef.length > EXTERNAL_REF_MAX_LENGTH) return { error: "refTooLong" };

  const note = blankToNull(input.note);
  if (note === null && type !== "topup") return { error: "noteRequired" };

  const rawDate = blankToNull(input.entryDate);
  const entryDate = rawDate === null ? now : parseDateInput(rawDate);
  if (entryDate === null) return { error: "invalidDate" };

  const signedCents = type === "topup" ? amountCents : -amountCents;
  return {
    plan: {
      type,
      amount: (signedCents / 100).toFixed(2),
      amountCents,
      method,
      externalRef,
      note,
      entryDate,
    },
  };
}

// A payout returns money the member holds: at most the current positive
// balance. When a payout is edited, `balance` already includes it, so its own
// amount (`currentPayout`, as stored) is available again: lowering a payout is
// always allowed. Returns null when `amount` fits, else the limit in euros.
export function validatePayoutAmount(
  amount: number,
  balance: number,
  currentPayout = 0,
): { limit: number } | null {
  const limitCents = Math.max(toCents(balance), 0) + Math.abs(toCents(currentPayout));
  return toCents(amount) > limitCents ? { limit: limitCents / 100 } : null;
}

// Same member, same type, same amount within this many days of the new
// entry's date (either side: entries can be backdated) looks like the same
// transfer recorded twice. It is only a warning: the admin can confirm.
export const DUPLICATE_WINDOW_DAYS = 7;
const DUPLICATE_WINDOW_MS = DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function duplicateWindow(entryDate: Date): { from: Date; to: Date } {
  return {
    from: new Date(entryDate.getTime() - DUPLICATE_WINDOW_MS),
    to: new Date(entryDate.getTime() + DUPLICATE_WINDOW_MS),
  };
}

// `rows` are the member's entries of the same type (the caller filters).
export function findPossibleDuplicate<T extends { amount: string; entryDate: Date }>(
  rows: ReadonlyArray<T>,
  amountCents: number,
  entryDate: Date,
): T | null {
  const { from, to } = duplicateWindow(entryDate);
  return (
    rows.find(
      (row) =>
        // Outgoing rows are stored negative: compare what was moved.
        Math.abs(toCents(parseFloat(row.amount))) === amountCents &&
        row.entryDate.getTime() >= from.getTime() &&
        row.entryDate.getTime() <= to.getTime(),
    ) ?? null
  );
}

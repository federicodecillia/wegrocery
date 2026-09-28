// Pure rules for admin edits to ledger entries, extracted so they can be unit
// tested ("use server" modules can only export async functions).

// Charges written by the system at cycle close (and by the shipping
// recompute / distinta import). An admin fixes them with a new `correction`
// entry, never by editing or deleting the row: the original charge is the
// reference every later correction is computed against.
const SYSTEM_CHARGE_TYPES = new Set(["order_charge", "shipping_charge"]);

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

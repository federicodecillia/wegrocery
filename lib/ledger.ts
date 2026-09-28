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

// The Cassa editor shows the absolute value; this puts the entry's own sign
// back on what the admin typed. A refund (+8) whose note is edited stays +8.
// Entries stored as 0 carry no sign, so they fall back to the type's natural
// one (topup positive, everything else negative). Unparseable input returns
// NaN so the server-side validation rejects it with a readable message.
export function applyOriginalSign(originalAmount: string, type: string, input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const magnitude = Math.abs(Number(trimmed.replace(",", ".")));
  if (!Number.isFinite(magnitude)) return NaN;
  const originalSign = Math.sign(parseFloat(originalAmount));
  const sign = originalSign !== 0 ? originalSign : type === "topup" ? 1 : -1;
  return sign * magnitude;
}

export function validateLedgerEntryEdit(
  entry: { type: string; amount: string },
  newAmount: number,
): LedgerAmountError | null {
  if (!isAdminEditableLedgerType(entry.type)) return "notEditable";
  if (!Number.isFinite(newAmount)) return "notFinite";
  const newCents = toCents(newAmount);
  if (newCents === 0) return "zero";
  const originalSign = Math.sign(toCents(parseFloat(entry.amount)));
  // No UI flips a sign on purpose: a sign change is always the old
  // recompute-from-type bug or a typo, and it moves twice the amount.
  if (originalSign !== 0 && originalSign !== Math.sign(newCents)) return "signChange";
  return null;
}

export function validateTopupAmount(amount: number): LedgerAmountError | null {
  if (!Number.isFinite(amount)) return "notFinite";
  const cents = toCents(amount);
  if (cents === 0) return "zero";
  if (cents < 0) return "notPositive";
  return null;
}

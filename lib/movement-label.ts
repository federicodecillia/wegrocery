import type { Strings } from "@/lib/i18n";

// How a member reads a ledger row (home "Ultimi movimenti" and Storico
// "Movimenti"): one mapping over type, amount sign and payment link.

type MovementLabels = Strings["history"];

// Every `ledger_entries.type` the database can hold (migrations 0000-0027):
// the types the app writes plus the legacy `adjustment`. A new one is added
// here, in `movementKind` and in the Cassa badges (`lib/ledger-badge.ts`).
export const LEDGER_TYPES = [
  "topup",
  "order_charge",
  "shipping_charge",
  "handling_charge",
  "correction",
  "adjustment",
  "payout",
  "manual_charge",
  "membership_fee",
  "refund_failed",
  "reversal",
  "order_payment",
  "order_refund",
  "balance_payment",
  "member_merge",
] as const;

export type LedgerMovement = {
  type: string;
  amount: string | number;
  paymentId: string | null;
};

// What kind of movement a ledger row is, for its label and its icon. A
// correction is split by direction; a negative one linked to a payment is a
// Stripe refund, part of an online top-up going back to the card.
export type MovementKind =
  | "topup"
  | "online_topup"
  | "order"
  | "shipping"
  | "handling"
  | "refund"
  | "online_refund"
  | "refund_failed"
  | "order_payment"
  | "order_refund"
  | "balance_payment"
  | "member_merge"
  | "reversal"
  | "adjustment"
  | "payout"
  | "manual_charge"
  | "membership_fee"
  | "other";

export function movementKind(entry: LedgerMovement): MovementKind {
  const amount = typeof entry.amount === "string" ? parseFloat(entry.amount) : entry.amount;
  switch (entry.type) {
    case "topup":
      return entry.paymentId ? "online_topup" : "topup";
    case "order_charge":
      return "order";
    case "shipping_charge":
      return "shipping";
    case "handling_charge":
      return "handling";
    case "correction":
      if (amount > 0) return "refund";
      return entry.paymentId ? "online_refund" : "adjustment";
    case "refund_failed":
      // A card refund Stripe could not pay: the money is back on the balance.
      return "refund_failed";
    case "reversal":
      // Hidden from the lists (lib/db/ledger-live.ts); named for any other view.
      return "reversal";
    case "order_payment":
    case "order_refund":
    case "balance_payment":
      // Pay-per-order: the payment that confirmed an order, money going back
      // to the card it came from, and the payment of an amount due.
      return entry.type;
    case "member_merge":
      // The balance of a duplicate account moved onto the one that stays
      // (lib/members/merge-store.ts): out on one, in on the other.
      return "member_merge";
    case "adjustment":
      // Legacy type of unknown intent (opening balances included): neutral.
      return "adjustment";
    case "payout":
    case "manual_charge":
    case "membership_fee":
      return entry.type;
    default:
      return "other";
  }
}

export function movementLabel(entry: LedgerMovement, labels: MovementLabels): string {
  return movementKindLabel(movementKind(entry), labels);
}

export function movementKindLabel(kind: MovementKind, labels: MovementLabels): string {
  const byKind: Record<MovementKind, string> = {
    topup: labels.topup,
    online_topup: labels.onlineTopup,
    order: labels.orderCharge,
    shipping: labels.shipping,
    handling: labels.handlingFee,
    refund: labels.refund,
    online_refund: labels.onlineTopupRefund,
    refund_failed: labels.refundFailed,
    order_payment: labels.orderPayment,
    order_refund: labels.orderRefund,
    balance_payment: labels.balancePayment,
    member_merge: labels.memberMerge,
    reversal: labels.reversal,
    adjustment: labels.correction,
    payout: labels.payout,
    manual_charge: labels.manualCharge,
    membership_fee: labels.membershipFee,
    other: labels.otherMovement,
  };
  return byKind[kind];
}

// The label, then the note when it adds something. Stripe rows carry a fixed
// note that repeats the label; a note that starts with the label
// ("Spedizione rettificata") is more specific and replaces it.
export function movementText(
  entry: LedgerMovement & { note: string | null },
  labels: MovementLabels,
): string {
  const label = movementLabel(entry, labels);
  const note = entry.note?.trim();
  if (!note || entry.paymentId) return label;
  if (note.toLowerCase().startsWith(label.toLowerCase())) return note;
  return `${label} · ${note}`;
}

// Who recorded a ledger row, as the Storico detail shows it: the online
// payment for Stripe rows, else the name of the member whose email created_by
// holds (an admin), else the system (legacy rows, accounts since deleted).
// Never an email: getMemberLedger resolves the name server side.
export type MovementRecorder = { kind: "online" } | { kind: "admin"; name: string } | { kind: "system" };

export function movementRecorder(entry: { paymentId: string | null; recorderName: string | null }): MovementRecorder {
  if (entry.paymentId) return { kind: "online" };
  const name = entry.recorderName?.trim();
  return name ? { kind: "admin", name } : { kind: "system" };
}

// Cassa movements are dated by day, stored at UTC midnight (parseDateInput in
// lib/ledger.ts): their time of day means nothing to the member. Rows the app
// timestamps (cycle close, weighing, Stripe) keep it.
export function movementDateHasTime(entryDate: Date): boolean {
  return (
    entryDate.getUTCHours() !== 0 ||
    entryDate.getUTCMinutes() !== 0 ||
    entryDate.getUTCSeconds() !== 0 ||
    entryDate.getUTCMilliseconds() !== 0
  );
}

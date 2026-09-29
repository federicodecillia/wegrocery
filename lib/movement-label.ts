import type { Strings } from "@/lib/i18n";

// How a member reads a ledger row (home "Ultimi movimenti" and Storico
// "Movimenti"): one mapping over type, amount sign and payment link.

type MovementLabels = Strings["history"];

export type LedgerMovement = {
  type: string;
  amount: string | number;
  paymentId: string | null;
};

export function movementLabel(entry: LedgerMovement, labels: MovementLabels): string {
  const amount = typeof entry.amount === "string" ? parseFloat(entry.amount) : entry.amount;
  switch (entry.type) {
    case "topup":
      return entry.paymentId ? labels.onlineTopup : labels.topup;
    case "order_charge":
      return labels.orderCharge;
    case "shipping_charge":
      return labels.shipping;
    case "correction":
      if (amount > 0) return labels.refund;
      // A negative row linked to a payment is a Stripe refund: part of an
      // online top-up going back to the card.
      return entry.paymentId ? labels.onlineTopupRefund : labels.correction;
    case "adjustment":
      // Legacy type of unknown intent (opening balances included): neutral.
      return labels.correction;
    case "payout":
      return labels.payout;
    case "manual_charge":
      return labels.manualCharge;
    case "membership_fee":
      return labels.membershipFee;
    default:
      return labels.otherMovement;
  }
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

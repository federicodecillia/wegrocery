// Pure rules of the settlement ("Chiudi i conti") of a pay-per-order cycle:
// once the costs are final, what happens to each member's cycle net (what
// they paid minus what the order cost). Cents throughout.

// Stripe's minimum charge: below it a shortfall is written off.
export const SETTLEMENT_MIN_DUE_CENTS = 50;

export type SettlementPayment = {
  paymentId: string;
  createdAt: Date;
  amountCents: number;
  // Refunds Stripe accepted, and refunds asked for and not answered yet.
  refundedCents: number;
  requestedCents: number;
};

export type SettlementInput = {
  memberId: string;
  // SUM of the member's ledger rows on the cycle: payments in, costs out.
  netCents: number;
  // Refunds of this cycle asked for and not yet in the ledger.
  requestedCents: number;
  paysOffline: boolean;
  payments: SettlementPayment[];
};

export type SettlementPlan =
  | { kind: "settled" }
  | { kind: "offline" }
  // Card refunds, newest payment first; excess = what the payments cannot give
  // back (for example an admin credit on the cycle): returned from Treasury.
  | { kind: "refund"; refunds: { paymentId: string; amountCents: number }[]; excessCents: number }
  | { kind: "due"; dueCents: number }
  | { kind: "writeOff"; cents: number };

export function planMemberSettlement(input: SettlementInput): SettlementPlan {
  if (input.paysOffline) return { kind: "offline" };
  const target = input.netCents - input.requestedCents;
  if (target === 0) return { kind: "settled" };
  if (target < 0) {
    const due = -target;
    return due >= SETTLEMENT_MIN_DUE_CENTS ? { kind: "due", dueCents: due } : { kind: "writeOff", cents: due };
  }
  let left = target;
  const refunds: { paymentId: string; amountCents: number }[] = [];
  const newestFirst = [...input.payments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.paymentId < b.paymentId ? 1 : -1),
  );
  for (const p of newestFirst) {
    if (left === 0) break;
    const refundable = p.amountCents - p.refundedCents - p.requestedCents;
    if (refundable <= 0) continue;
    const amount = Math.min(refundable, left);
    refunds.push({ paymentId: p.paymentId, amountCents: amount });
    left -= amount;
  }
  return { kind: "refund", refunds, excessCents: left };
}

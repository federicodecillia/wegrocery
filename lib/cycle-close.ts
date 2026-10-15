// Pure part of closing a cycle, extracted from performCycleClose in
// lib/cycle-close-store.ts so it can be unit tested. The store turns these
// rows (order, shipping and order preparation fee charges) into ledger
// inserts and runs them, together with the status flip, in one db.batch.

import { handlingFeeCents, type HandlingFee } from "./payments/order-payment";
import { computeShippingShares, type ShippingConfig } from "./shipping";

export type MemberOrderTotal = { memberId: string; total: string };

export type AlreadyCharged = { order: ReadonlySet<string>; shipping: ReadonlySet<string>; handling: ReadonlySet<string> };

export type CycleCloseCharges = {
  // Ledger amounts are negative (money leaving the member's balance).
  orderCharges: Array<{ memberId: string; amount: string }>;
  shippingCharges: Array<{ memberId: string; amount: string }>;
  // The order preparation fee, one per member with products whose fee is above zero.
  handlingCharges: Array<{ memberId: string; amount: string }>;
  // One per newly order-charged member, for the order_closed notification.
  summaries: Array<{ memberId: string; orderTotal: number; shippingShare: number; handlingShare: number }>;
};

const NONE: AlreadyCharged = { order: new Set(), shipping: new Set(), handling: new Set() };

// `alreadyCharged` protects a cycle left open with charges by the pre-atomic
// close (a failure after the first insert used to reopen it): those members
// are not charged again. Shipping shares are still computed over every
// member with an order, so a proportional split stays the same.
export function buildCycleCloseCharges(
  memberTotals: ReadonlyArray<MemberOrderTotal>,
  cycle: ShippingConfig,
  opts: { fee?: HandlingFee | null; alreadyCharged?: AlreadyCharged } = {},
): CycleCloseCharges {
  const fee = opts.fee ?? null;
  const alreadyCharged = opts.alreadyCharged ?? NONE;
  const charged = memberTotals.filter((r) => parseFloat(r.total) > 0);
  const shares = computeShippingShares(charged, cycle);

  const result: CycleCloseCharges = { orderCharges: [], shippingCharges: [], handlingCharges: [], summaries: [] };
  for (const r of charged) {
    const orderTotal = parseFloat(r.total);
    const shippingShare = shares.get(r.memberId) ?? 0;
    // The base is the order total in cents, exactly what order_charge holds.
    const handlingCents = handlingFeeCents(Math.round(orderTotal * 100), fee);
    if (!alreadyCharged.order.has(r.memberId)) {
      result.orderCharges.push({ memberId: r.memberId, amount: (-orderTotal).toFixed(2) });
      result.summaries.push({ memberId: r.memberId, orderTotal, shippingShare, handlingShare: handlingCents / 100 });
    }
    if (shippingShare > 0 && !alreadyCharged.shipping.has(r.memberId)) {
      result.shippingCharges.push({ memberId: r.memberId, amount: (-shippingShare).toFixed(2) });
    }
    if (handlingCents > 0 && !alreadyCharged.handling.has(r.memberId)) {
      result.handlingCharges.push({ memberId: r.memberId, amount: (-handlingCents / 100).toFixed(2) });
    }
  }
  return result;
}

// JSON object memberId → order total, exactly as the DB returned the sums.
// The close batch compares it (as jsonb, so key order is irrelevant) with the
// same aggregate recomputed inside the transaction: if a member's order
// changed between our read and the batch, the charges would be stale and the
// batch aborts instead.
export function ordersSnapshot(memberTotals: ReadonlyArray<MemberOrderTotal>): string {
  return JSON.stringify(Object.fromEntries(memberTotals.map((r) => [r.memberId, r.total])));
}

// Which of a cancelled cycle's ledger rows the cancellation reverses. A wallet
// cycle: its whole net (charges and later corrections), shipping aside when the
// group keeps it. A pay-per-order cycle: only what was charged, never the
// payments and refunds, or the member would get nothing back (the settlement
// then returns what they paid). The order preparation fee always goes back:
// the order it paid for never happened.
export function cancelledCycleReversalTypes(
  paymentMode: string,
  refundShipping: boolean,
): { include: string[] } | { exclude: string[] } | null {
  if (paymentMode === "per_order") {
    return {
      include: refundShipping
        ? ["order_charge", "shipping_charge", "handling_charge", "correction"]
        : ["order_charge", "handling_charge", "correction"],
    };
  }
  return refundShipping ? null : { exclude: ["shipping_charge"] };
}

// Closing with the supplier's sheet: what each member ends up paying for the
// cycle, for the single notification. The close charged order, shipping and
// fee; the sheet then moved line totals (delta = new - old, positive when the
// supplier asks more) and shipping shares. The fee stays the one charged at
// the close, as with every post-closure correction.
export function finalCostsAfterDistinta(
  summaries: CycleCloseCharges["summaries"],
  corrections: ReadonlyArray<{ memberId: string; delta: number }>,
  shippingChanges: ReadonlyArray<{ memberId: string; oldShipping: number; newShipping: number }>,
): Map<string, number> {
  const cents = new Map<string, number>();
  const add = (memberId: string, amount: number) =>
    cents.set(memberId, (cents.get(memberId) ?? 0) + Math.round(amount * 100));
  for (const s of summaries) add(s.memberId, s.orderTotal + s.shippingShare + s.handlingShare);
  for (const c of corrections) add(c.memberId, c.delta);
  for (const s of shippingChanges) add(s.memberId, s.newShipping - s.oldShipping);
  return new Map([...cents].map(([memberId, c]) => [memberId, c / 100]));
}

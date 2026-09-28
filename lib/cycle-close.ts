// Pure part of closing a cycle, extracted from performCycleClose in
// lib/actions/admin.ts so it can be unit tested ("use server" modules can
// only export async functions). The action turns these rows into ledger
// inserts and runs them, together with the status flip, in one db.batch.

import { computeShippingShares, type ShippingConfig } from "./shipping";

export type MemberOrderTotal = { memberId: string; total: string };

export type CycleCloseCharges = {
  // Ledger amounts are negative (money leaving the member's balance).
  orderCharges: Array<{ memberId: string; amount: string }>;
  shippingCharges: Array<{ memberId: string; amount: string }>;
  // One per newly order-charged member, for the order_closed notification.
  summaries: Array<{ memberId: string; orderTotal: number; shippingShare: number }>;
};

// `alreadyCharged` protects a cycle left open with charges by the pre-atomic
// close (a failure after the first insert used to reopen it): those members
// are not charged again. Shipping shares are still computed over every
// member with an order, so a proportional split stays the same.
export function buildCycleCloseCharges(
  memberTotals: ReadonlyArray<MemberOrderTotal>,
  cycle: ShippingConfig,
  alreadyCharged: { order: ReadonlySet<string>; shipping: ReadonlySet<string> } = {
    order: new Set(),
    shipping: new Set(),
  },
): CycleCloseCharges {
  const charged = memberTotals.filter((r) => parseFloat(r.total) > 0);
  const shares = computeShippingShares(charged, cycle);

  const result: CycleCloseCharges = { orderCharges: [], shippingCharges: [], summaries: [] };
  for (const r of charged) {
    const orderTotal = parseFloat(r.total);
    const shippingShare = shares.get(r.memberId) ?? 0;
    if (!alreadyCharged.order.has(r.memberId)) {
      result.orderCharges.push({ memberId: r.memberId, amount: (-orderTotal).toFixed(2) });
      result.summaries.push({ memberId: r.memberId, orderTotal, shippingShare });
    }
    if (shippingShare > 0 && !alreadyCharged.shipping.has(r.memberId)) {
      result.shippingCharges.push({ memberId: r.memberId, amount: (-shippingShare).toFixed(2) });
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

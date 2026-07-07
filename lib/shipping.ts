// Pure shipping-share math, extracted from lib/actions/admin.ts ("use server"
// files can only export async functions, which made this untestable in place).

export type ShippingMode = "fixed_per_member" | "proportional";

export function normalizeShippingMode(mode: string | undefined): ShippingMode {
  return mode === "proportional" ? "proportional" : "fixed_per_member";
}

// Returns each member's shipping share in euros, keyed by memberId.
// - fixed_per_member: every member pays shippingCostPerMember.
// - proportional: shippingTotal is split weighted by each member's order total,
//   each share rounded to 2 decimals. Any cent left over by the rounding (so
//   that sum-of-shares equals shippingTotal exactly) is added to the member
//   with the largest order — picking deterministically so reruns match.
export function computeShippingShares(
  memberTotals: ReadonlyArray<{ memberId: string; total: string }>,
  cycle: {
    shippingMode: string;
    shippingCostPerMember: string | null;
    shippingTotal: string | null;
  },
): Map<string, number> {
  const shares = new Map<string, number>();
  if (memberTotals.length === 0) return shares;

  if (cycle.shippingMode === "proportional") {
    const shippingTotal = cycle.shippingTotal ? parseFloat(cycle.shippingTotal) : 0;
    if (shippingTotal <= 0) return shares;

    const grand = memberTotals.reduce((sum, r) => sum + parseFloat(r.total), 0);
    if (grand <= 0) return shares;

    let allocatedCents = 0;
    const targetCents = Math.round(shippingTotal * 100);

    for (const r of memberTotals) {
      const memberTotal = parseFloat(r.total);
      const cents = Math.round((memberTotal / grand) * targetCents);
      shares.set(r.memberId, cents / 100);
      allocatedCents += cents;
    }

    const drift = targetCents - allocatedCents;
    if (drift !== 0) {
      // Pick the member with the largest order; ties broken by memberId for
      // determinism so two reruns produce the same allocation.
      const heaviest = [...memberTotals].sort((a, b) => {
        const diff = parseFloat(b.total) - parseFloat(a.total);
        return diff !== 0 ? diff : a.memberId.localeCompare(b.memberId);
      })[0];
      const current = shares.get(heaviest.memberId) ?? 0;
      shares.set(heaviest.memberId, current + drift / 100);
    }
    return shares;
  }

  const flat = cycle.shippingCostPerMember ? parseFloat(cycle.shippingCostPerMember) : 0;
  if (flat <= 0) return shares;
  for (const r of memberTotals) shares.set(r.memberId, flat);
  return shares;
}

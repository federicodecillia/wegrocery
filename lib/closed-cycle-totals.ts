// Totals shown in the admin closed-cycle modal: what the ledger actually
// charged per member (products + shipping + order preparation fee). The
// shipping and fee amounts are read from live ledger rows, never recomputed.

const toCents = (eur: number) => Math.round(eur * 100);

export function closedCycleMemberTotal(parts: {
  products: number;
  shipping: number;
  handling: number;
}): number {
  return (toCents(parts.products) + toCents(parts.shipping) + toCents(parts.handling)) / 100;
}

export function closedCycleGrandTotal(parts: {
  products: number;
  shipping: ReadonlyArray<{ amount: number }>;
  handling: ReadonlyArray<{ amount: number }>;
}): number {
  const sum = (rows: ReadonlyArray<{ amount: number }>) =>
    rows.reduce((s, r) => s + toCents(r.amount), 0);
  return (toCents(parts.products) + sum(parts.shipping) + sum(parts.handling)) / 100;
}

type MemberAmount = { memberId: string; memberName: string; amount: number };

export type ClosedCycleMemberRow<L> = {
  memberId: string;
  memberName: string;
  lines: L[];
  shipping: number;
  handling: number;
};

// One row per member the modal lists: everyone with an order line, then those
// charged shipping or the fee who have none left (their order was emptied
// after the close), so the members shown always add up to the total. Members
// are told apart by id, not by name.
export function closedCycleMemberRows<L extends { memberId: string; memberName: string }>(
  orders: ReadonlyArray<L>,
  shipping: ReadonlyArray<MemberAmount>,
  handling: ReadonlyArray<MemberAmount>,
): ClosedCycleMemberRow<L>[] {
  const rows = new Map<string, ClosedCycleMemberRow<L>>();
  const row = (memberId: string, memberName: string) => {
    let r = rows.get(memberId);
    if (!r) {
      r = { memberId, memberName, lines: [], shipping: 0, handling: 0 };
      rows.set(memberId, r);
    }
    return r;
  };
  for (const l of orders) row(l.memberId, l.memberName).lines.push(l);
  for (const s of shipping) {
    const r = row(s.memberId, s.memberName);
    r.shipping = (toCents(r.shipping) + toCents(s.amount)) / 100;
  }
  for (const h of handling) {
    const r = row(h.memberId, h.memberName);
    r.handling = (toCents(r.handling) + toCents(h.amount)) / 100;
  }
  // A charge reversed to zero leaves nothing to show for a member without lines.
  return [...rows.values()].filter((r) => r.lines.length > 0 || r.shipping !== 0 || r.handling !== 0);
}

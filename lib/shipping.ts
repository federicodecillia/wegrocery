// Pure shipping-share math, extracted from lib/actions/admin.ts ("use server"
// files can only export async functions, which made this untestable in place).

// "manual" is set only by the supplier-distinta import: shipping_charge
// entries were written per member from the supplier's sheet, and nothing else
// may recompute or overwrite them.
export type ShippingMode = "fixed_per_member" | "proportional" | "manual";

export function normalizeShippingMode(mode: string | undefined): ShippingMode {
  if (mode === "proportional" || mode === "manual") return mode;
  return "fixed_per_member";
}

export type ShippingConfig = {
  shippingMode: string;
  shippingCostPerMember: string | null;
  shippingTotal: string | null;
};

export type ShippingInput = {
  shippingMode?: string;
  shippingCostPerMember?: string;
  shippingTotal?: string;
};

function toCentsOrNull(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  return Math.round(parseFloat(value) * 100);
}

// Works out the order_cycles patch for the shipping fields of an admin cycle
// edit, and whether the effective shipping configuration really changed (the
// only case in which a closed cycle's shipping_charge entries are recomputed
// and members notified). Rules:
// - a manual cycle keeps its per-member values: the edit form resubmits
//   "manual" with empty fee fields, which must not read as "fee cleared";
// - a cycle edit can neither enter nor leave manual mode (only the distinta
//   import sets it);
// - an explicit mode is authoritative and clears the other mode's field;
// - values are compared in cents, so "2.5" resubmitted over "2.50" is no change.
export function resolveShippingUpdate(
  before: ShippingConfig,
  data: ShippingInput,
): { patch: Partial<ShippingConfig>; changed: boolean } {
  if (before.shippingMode === "manual") return { patch: {}, changed: false };

  let patch: Partial<ShippingConfig>;
  if (data.shippingMode !== undefined) {
    const mode = normalizeShippingMode(data.shippingMode);
    if (mode === "manual") return { patch: {}, changed: false };
    patch = {
      shippingMode: mode,
      shippingCostPerMember: mode === "fixed_per_member" ? data.shippingCostPerMember || null : null,
      shippingTotal: mode === "proportional" ? data.shippingTotal || null : null,
    };
  } else {
    patch = {
      ...(data.shippingCostPerMember !== undefined && {
        shippingCostPerMember: data.shippingCostPerMember || null,
      }),
      ...(data.shippingTotal !== undefined && { shippingTotal: data.shippingTotal || null }),
    };
  }

  const after = { ...before, ...patch };
  const changed =
    after.shippingMode !== before.shippingMode ||
    toCentsOrNull(after.shippingCostPerMember) !== toCentsOrNull(before.shippingCostPerMember) ||
    toCentsOrNull(after.shippingTotal) !== toCentsOrNull(before.shippingTotal);
  return { patch, changed };
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

// A closed cycle's shipping_charge ledger row. There is at most one per member
// (unique index, drizzle/0013_unique_cycle_charges.sql).
export type ShippingChargeRow = { entryId: string; memberId: string; amount: string };

export type ShippingRecomputePlan = {
  // Existing rows rewritten in place with a new ledger amount. A reversal is
  // an update to "0.00": shipping rows are never deleted.
  updates: Array<{ entryId: string; memberId: string; amount: string }>;
  // Members without a shipping row who now owe a share.
  inserts: Array<{ memberId: string; amount: string }>;
  // One entry per member whose share moved (in euros): the members to notify.
  changes: Array<{ memberId: string; oldShare: number; newShare: number }>;
};

// Plans a closed cycle's shipping recompute: the shares computeShippingShares
// gives on `totals` (the members' EFFECTIVE totals, after weighing) against
// the shipping rows already posted. Every member with a row is included, so
// one whose total dropped to 0, or who has no order left, is reversed. A
// manual (distinta-imported) cycle is never touched. Writing the plan and
// planning again yields an empty plan, so a rerun is harmless.
export function planShippingRecompute(
  cycle: ShippingConfig,
  totals: ReadonlyArray<{ memberId: string; total: string }>,
  existing: ReadonlyArray<ShippingChargeRow>,
): ShippingRecomputePlan {
  const plan: ShippingRecomputePlan = { updates: [], inserts: [], changes: [] };
  if (cycle.shippingMode === "manual") return plan;

  // Sorted because computeShippingShares' float sum depends on the order of
  // its input, and GROUP BY returns rows in any order: a rerun must agree.
  const byMember = (a: { memberId: string }, b: { memberId: string }) =>
    a.memberId.localeCompare(b.memberId);
  const eligible = totals.filter((r) => parseFloat(r.total) > 0).sort(byMember);
  const shares = computeShippingShares(eligible, cycle);
  const rowByMember = new Map(existing.map((r) => [r.memberId, r]));
  const memberIds = new Set([...eligible, ...existing].sort(byMember).map((r) => r.memberId));

  for (const memberId of memberIds) {
    const newCents = Math.round((shares.get(memberId) ?? 0) * 100);
    const row = rowByMember.get(memberId);
    // 0 - x rather than -x: a "0.00" row must read as 0, not -0, which
    // formatMoney prints as "-0,00 €".
    const oldCents = row ? 0 - Math.round(parseFloat(row.amount) * 100) : 0;
    if (newCents === oldCents) continue;

    const amount = (-newCents / 100).toFixed(2);
    if (row) plan.updates.push({ entryId: row.entryId, memberId, amount });
    else plan.inserts.push({ memberId, amount });
    plan.changes.push({ memberId, oldShare: oldCents / 100, newShare: newCents / 100 });
  }
  return plan;
}

// JSON object entryId → amount of a cycle's shipping rows, with the money
// exactly as the DB returned it. A recompute batch compares it (as jsonb) with
// the same object rebuilt inside the transaction and aborts when the rows
// changed after the plan was computed.
export function shippingRowsSnapshot(rows: ReadonlyArray<ShippingChargeRow>): string {
  return JSON.stringify(Object.fromEntries(rows.map((r) => [r.entryId, r.amount])));
}

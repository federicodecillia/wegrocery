import { normalizeEmail } from "@/lib/member-email";

// Merging two accounts of the same person (Admin -> Members -> Merge): the
// pure decision, unit tested; lib/members/merge-store.ts reads the state and
// writes the plan in one guarded batch.
//
// The survivor keeps its name, role, primary address, card status and
// preferences. From the absorbed account it takes the orders on open cycles,
// the drafts, the notifications and the balance. The balance moves as a pair
// of 'member_merge' rows: the ledger is append-only, no row changes member,
// and closed-cycle orders stay next to their charges on the absorbed account
// (the nightly closed_cycle_charge check pairs them). An absorbed account left
// with nothing is deleted; one with history is kept, inactive, with
// merged_into set and its addresses freed.

export type MergeMember = {
  memberId: string;
  fullName: string;
  email: string;
  aliasEmail: string | null;
  active: boolean;
  mergedInto: string | null;
};

export type MergeOrderCycle = {
  cycleId: string;
  title: string;
  status: string;
  paymentMode: string;
};

export type MergeState = {
  survivor: MergeMember;
  absorbed: MergeMember;
  // The admin doing the merge: their own account is never absorbed (they
  // would lose the session's admin role mid-action).
  actingMemberId: string | null;
  // Cycles where the absorbed account has order lines.
  absorbedOrderCycles: MergeOrderCycle[];
  // Open cycles where the survivor has order lines.
  survivorOpenOrderCycleIds: string[];
  absorbedBalanceCents: number;
  absorbedLedgerRows: number;
  absorbedPayments: number;
  absorbedPendingPayments: number;
  // Refunds Stripe has not settled yet ('requested' or 'pending').
  absorbedOpenRefunds: number;
  // Pay-per-order cycles not settled yet where the absorbed account has
  // movements: their money belongs to that account's card payments.
  absorbedUnsettledPerOrderCycles: number;
};

export type MergeRefusal =
  | { code: "same_member" }
  | { code: "already_merged"; fullName: string }
  | { code: "survivor_inactive" }
  | { code: "absorbing_self" }
  | { code: "both_ordered"; cycleTitle: string }
  | { code: "per_order_open"; cycleTitle: string }
  | { code: "pending_payment" }
  | { code: "open_refund" }
  | { code: "unsettled_per_order" }
  | { code: "alias_not_offered" };

export type MergePlan = {
  // Open cycles whose order lines move to the survivor.
  moveCycleIds: string[];
  // Moved as a pair: -transfer on the absorbed account, +transfer on the survivor.
  transferCents: number;
  deleteAbsorbed: boolean;
  // The survivor's addresses afterwards.
  survivorEmail: string;
  survivorAlias: string | null;
  // Addresses that sign in to nothing after the merge: their sign-in
  // identities and sessions go.
  droppedAddresses: string[];
};

export type MergeDecision = { ok: true; plan: MergePlan } | { ok: false; refusal: MergeRefusal };

// The addresses that can be the survivor's secondary one: there is a single
// slot, so with more than one the admin picks. First = default: the absorbed
// account's primary address, the one the person signs in with now.
export function aliasOptions(survivor: MergeMember, absorbed: MergeMember): string[] {
  const primary = normalizeEmail(survivor.email);
  const out: string[] = [];
  for (const a of [absorbed.email, survivor.aliasEmail, absorbed.aliasEmail]) {
    const n = normalizeEmail(a);
    if (n && n !== primary && !out.includes(n)) out.push(n);
  }
  return out;
}

// alias: the address chosen for the secondary slot; undefined = the default.
export function planMemberMerge(state: MergeState, alias?: string | null): MergeDecision {
  const { survivor, absorbed } = state;
  const refuse = (refusal: MergeRefusal): MergeDecision => ({ ok: false, refusal });

  if (survivor.memberId === absorbed.memberId) return refuse({ code: "same_member" });
  if (survivor.mergedInto) return refuse({ code: "already_merged", fullName: survivor.fullName });
  if (absorbed.mergedInto) return refuse({ code: "already_merged", fullName: absorbed.fullName });
  if (!survivor.active) return refuse({ code: "survivor_inactive" });
  if (state.actingMemberId === absorbed.memberId) return refuse({ code: "absorbing_self" });

  const open = state.absorbedOrderCycles.filter((c) => c.status === "open");
  for (const c of open) {
    // Coverage of a pay-per-order cycle is per member: its orders stay put.
    if (c.paymentMode === "per_order") return refuse({ code: "per_order_open", cycleTitle: c.title });
    // Two confirmed orders are never added up: nobody confirmed the sum.
    if (state.survivorOpenOrderCycleIds.includes(c.cycleId)) return refuse({ code: "both_ordered", cycleTitle: c.title });
  }
  if (state.absorbedPendingPayments > 0) return refuse({ code: "pending_payment" });
  if (state.absorbedOpenRefunds > 0) return refuse({ code: "open_refund" });
  if (state.absorbedUnsettledPerOrderCycles > 0) return refuse({ code: "unsettled_per_order" });

  const options = aliasOptions(survivor, absorbed);
  const chosen = alias === undefined ? (options[0] ?? null) : normalizeEmail(alias);
  if (chosen !== null && !options.includes(chosen)) return refuse({ code: "alias_not_offered" });

  const keepsHistory =
    state.absorbedLedgerRows > 0 ||
    state.absorbedPayments > 0 ||
    state.absorbedOrderCycles.some((c) => c.status !== "open");

  return {
    ok: true,
    plan: {
      moveCycleIds: open.map((c) => c.cycleId),
      transferCents: state.absorbedBalanceCents,
      deleteAbsorbed: !keepsHistory,
      survivorEmail: normalizeEmail(survivor.email)!,
      survivorAlias: chosen,
      droppedAddresses: options.filter((a) => a !== chosen),
    },
  };
}

// The placeholder address of an absorbed account kept for its history:
// unique, never deliverable (.invalid is reserved by RFC 2606), and it frees
// the real address for the survivor.
export function mergedPlaceholderEmail(memberId: string): string {
  return `${memberId.toLowerCase()}@merged.invalid`;
}

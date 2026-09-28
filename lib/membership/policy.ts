// Pure decisions for the membership gate (sign-in + order) and the credit
// limit. No I/O here: auth.ts and lib/actions/order.ts do the lookups and the
// writes, these functions decide.

import type { MembershipResult } from "./wallyfor";

export type LoginError = "AccessDenied" | "NotMember" | "MembershipInactive" | "MembershipCheckUnavailable";

export type SignInDecision =
  | { kind: "check" }
  | { kind: "allow"; record?: "valid"; logError?: true }
  | { kind: "deny"; error: LoginError; record?: "invalid"; logError?: true }
  | { kind: "provision" };

/**
 * A member row already exists for the login email (or its alias).
 * `result` is null until the caller has run the check the decision asked for.
 */
export function existingMemberSignIn(
  member: { active: boolean; role: string },
  checkEnabled: boolean,
  result: MembershipResult | null,
): SignInDecision {
  // An admin deactivation always wins over a valid card.
  if (!member.active) return { kind: "deny", error: "AccessDenied" };
  if (member.role === "admin" || !checkEnabled) return { kind: "allow" };
  if (!result) return { kind: "check" };
  if (result.status === "valid") return { kind: "allow", record: "valid" };
  if (result.status === "invalid") return { kind: "deny", error: "MembershipInactive", record: "invalid" };
  // Fail open: they are already members, an API outage must not lock them out.
  return { kind: "allow", logError: true };
}

/**
 * No member row for the login email: self-onboarding when the check is on.
 * `emailVerified` is Google's `email_verified` claim: an account whose address
 * Google has not verified must never be auto-provisioned under it.
 */
export function newUserSignIn(
  checkEnabled: boolean,
  result: MembershipResult | null,
  emailVerified = true,
): SignInDecision {
  if (!checkEnabled || !emailVerified) return { kind: "deny", error: "AccessDenied" };
  if (!result) return { kind: "check" };
  if (result.status === "valid") return { kind: "provision" };
  if (result.status === "invalid") return { kind: "deny", error: "NotMember" };
  // Fail closed: we cannot tell a stranger from a member.
  return { kind: "deny", error: "MembershipCheckUnavailable", logError: true };
}

export function loginErrorPath(error: LoginError, email?: string | null): string {
  const params = new URLSearchParams({ error });
  if (email) params.set("email", email);
  return `/login?${params.toString().replace(/\+/g, "%20")}`;
}

export function fullNameFromProfile(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || email;
}

export const MEMBERSHIP_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * `raisesOrder`: whether this save raises the member's total on the cycle
 * (see raisesOrderTotal). Trimming or cancelling an order is never blocked, so
 * a member whose card lapsed can still withdraw what they ordered.
 */
export function shouldRecheckMembershipOnOrder(
  member: { role: string; membershipStatus: string | null; membershipVerifiedAt: Date | null },
  checkEnabled: boolean,
  now: Date,
  raisesOrder: boolean,
): boolean {
  if (!checkEnabled || member.role === "admin" || !raisesOrder) return false;
  // Only a recent *valid* result is cached; an invalid one is rechecked every
  // time so a member who just renewed can order straight away.
  if (member.membershipStatus !== "valid" || !member.membershipVerifiedAt) return true;
  return now.getTime() - member.membershipVerifiedAt.getTime() > MEMBERSHIP_RECHECK_MS;
}

export function orderMembershipOutcome(result: MembershipResult): { allow: boolean; record: "valid" | "invalid" | null } {
  if (result.status === "valid") return { allow: true, record: "valid" };
  if (result.status === "invalid") return { allow: false, record: "invalid" };
  return { allow: true, record: null };
}

export type CreditInput = {
  /** SUM(ledger_entries.amount) for the member */
  balance: number;
  /** Total of the member's orders on OTHER cycles still `open` (not yet charged) */
  openOrdersOtherCycles: number;
  /** The member's current saved total on this cycle (replaced by this save) */
  previousOrderTotal: number;
  newOrderTotal: number;
  /** Lowest allowed projected balance; null = no limit */
  minBalance: number | null;
};

export type CreditDecision = { ok: true } | { ok: false; available: number };

const cents = (n: number) => Math.round(n * 100);

/** True when the new cycle total is above the saved one (compared in cents). */
export function raisesOrderTotal(previousOrderTotal: number, newOrderTotal: number): boolean {
  return cents(newOrderTotal) > cents(previousOrderTotal);
}

export function evaluateCreditLimit(input: CreditInput): CreditDecision {
  if (input.minBalance === null) return { ok: true };
  // Never block a save that does not raise this cycle's order: a member
  // already past the limit must still be able to trim or cancel.
  if (!raisesOrderTotal(input.previousOrderTotal, input.newOrderTotal)) return { ok: true };
  const newTotal = cents(input.newOrderTotal);

  const availableCents = cents(input.balance) - cents(input.openOrdersOtherCycles) - cents(input.minBalance);
  if (newTotal <= availableCents) return { ok: true };
  return { ok: false, available: Math.max(0, availableCents) / 100 };
}

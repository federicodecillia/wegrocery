import { normalizeRole, type Role } from "@/lib/roles";

// Families: people sharing one account (cart, balance, history). Each person
// keeps their own member row (addresses, name, role, card) and points at the
// account with members.household_of; auth() serves the account. Pure rules
// here, unit tested; I/O in lib/actions/family.ts, the money move in
// lib/members/merge-store.ts (mode "link").

// People in one account, the account's own person included.
export const MAX_FAMILY_SIZE = 6;
// How long an invitation can be accepted.
export const INVITE_DAYS = 7;

export type FamilyPerson = {
  memberId: string;
  fullName: string;
  role: string;
  active: boolean;
  householdOf: string | null;
  mergedInto?: string | null;
};

// The role the session carries for a person in an account: the admin panel
// is personal (a partner never inherits it), cycle access is the higher of
// the person's and the account's, never admin.
export function familyRole(personRole: string, accountRole: string): Role | null {
  const person = normalizeRole(personRole);
  if (person === null) return null;
  if (person === "admin") return "admin";
  const account = normalizeRole(accountRole);
  return person === "attivi" || account === "attivi" || account === "admin" ? "attivi" : "utenti";
}

// The account a person's session uses: their own, or the one they joined.
// null when either is not active (a deactivated account signs its people out).
export function sessionAccount<P extends FamilyPerson>(person: P, account: P | null): P | null {
  if (!person.active) return null;
  if (!person.householdOf) return person;
  if (!account || account.memberId !== person.householdOf || !account.active) return null;
  return account;
}

export type InviteRefusal =
  | "disabled"
  | "not_member"
  | "self"
  | "inactive"
  | "already_in_family"
  | "has_family"
  | "already_here"
  | "already_invited"
  | "family_full";

// Whether the people of `accountId` may invite `target`. `accountSize`:
// people in the account now, its own person included.
export function checkInvite(input: {
  enabled: boolean;
  accountId: string;
  target: FamilyPerson | null;
  targetHouseholdMembers: number;
  accountSize: number;
  pendingToTarget: boolean;
}): InviteRefusal | null {
  const { target } = input;
  if (!input.enabled) return "disabled";
  if (!target || target.mergedInto) return "not_member";
  if (target.memberId === input.accountId) return "self";
  if (target.householdOf === input.accountId) return "already_here";
  if (!target.active) return "inactive";
  if (target.householdOf) return "already_in_family";
  if (input.targetHouseholdMembers > 0) return "has_family";
  if (input.accountSize >= MAX_FAMILY_SIZE) return "family_full";
  if (input.pendingToTarget) return "already_invited";
  return null;
}

export type UnlinkRefusal = "not_in_family" | "not_allowed";

// Who may take `person` out of the account they joined: the person (leave)
// or the account's own person (remove). An admin goes through Soci instead.
export function checkUnlink(person: FamilyPerson, actingPersonId: string): UnlinkRefusal | null {
  if (!person.householdOf) return "not_in_family";
  if (actingPersonId !== person.memberId && actingPersonId !== person.householdOf) return "not_allowed";
  return null;
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}

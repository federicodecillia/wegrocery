// Member roles and cycle access levels: the single source of truth.
//
// The same three words name a member's role (members.role) and the minimum
// role a cycle requires (order_cycles.access_level), ranked
// admin > attivi > utenti:
//   - admin  sees and orders in every cycle
//   - attivi sees 'utenti' and 'attivi' cycles
//   - utenti sees only 'utenti' cycles
//
// Values written before migration 0015 are still mapped here, so the code
// works whether or not that migration has run on the database it talks to.

import { t } from "@/lib/i18n";

export const ROLES = ["admin", "attivi", "utenti"] as const;
export type Role = (typeof ROLES)[number];

// Listed from the most open to the most restricted (the order of the admin
// cycle form).
export const ACCESS_LEVELS = ["utenti", "attivi", "admin"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Role given to self-onboarded members and preselected in the admin form. */
export const DEFAULT_ROLE: Role = "utenti";
/** A standard cycle, open to every member. */
export const DEFAULT_ACCESS_LEVEL: AccessLevel = "utenti";

const RANK: Record<Role, number> = { utenti: 0, attivi: 1, admin: 2 };

// Pre-0015 values. 'socio' was labelled "Utente" and 'attivo' "Socio";
// 'member' is an older alias of 'attivo'.
const LEGACY_ROLES = new Map<string, Role>([
  ["socio", "utenti"],
  ["attivo", "attivi"],
  ["member", "attivi"],
]);
const LEGACY_ACCESS_LEVELS = new Map<string, AccessLevel>([
  ["all", "utenti"],
  ["soci", "attivi"],
  ["member", "attivi"],
]);

function canonical(value: string | null | undefined): string | null {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

/** Canonical role for a stored or submitted value; null when unknown. */
export function normalizeRole(value: string | null | undefined): Role | null {
  const v = canonical(value);
  if (v === null) return null;
  return (ROLES as readonly string[]).includes(v) ? (v as Role) : (LEGACY_ROLES.get(v) ?? null);
}

/** Canonical access level for a stored or submitted value; null when unknown. */
export function normalizeAccessLevel(value: string | null | undefined): AccessLevel | null {
  const v = canonical(value);
  if (v === null) return null;
  return (ACCESS_LEVELS as readonly string[]).includes(v)
    ? (v as AccessLevel)
    : (LEGACY_ACCESS_LEVELS.get(v) ?? null);
}

/**
 * Whether a member with `role` can see and order in a cycle with
 * `accessLevel`. Unknown or missing roles are denied; an unknown access level
 * only lets admins in.
 */
export function canAccessCycle(accessLevel: string, role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (r === null) return false;
  if (r === "admin") return true;
  const level = normalizeAccessLevel(accessLevel);
  if (level === null) return false;
  return RANK[r] >= RANK[level];
}

export function getRoleLabel(role: string): string {
  const r = normalizeRole(role);
  return r ? t.roles[r] : role;
}

export function getAccessLabel(accessLevel: string): string {
  const level = normalizeAccessLevel(accessLevel);
  return level ? t.cycleAccess[level] : accessLevel;
}

// Pure access decisions shared by proxy.ts, the page guard and the
// Server Action guards in ./session.ts, and the session refresh in auth.ts.
// No imports on purpose: it stays dependency-free so any runtime can load it.

/** The session fields the guards read. auth() reads them from the members table on every request. */
export type SessionUser =
  | {
      email?: string | null;
      role?: unknown;
      active?: unknown;
      ordersReferent?: unknown;
    }
  | null
  | undefined;

export type AccessDecision =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "inactive" | "notAdmin" };

/**
 * `need: "member"`: any signed-in, active member. `"admin"`: an active member
 * whose role is admin. `"manager"`: an admin or an active "Referente ordini"
 * (the limited Admin area, lib/auth/manager.ts).
 */
export function checkAccess(user: SessionUser, need: "member" | "admin" | "manager"): AccessDecision {
  if (!user?.email) return { ok: false, reason: "unauthenticated" };
  // Fail closed: only an explicit `true` from the session refresh counts.
  if (user.active !== true) return { ok: false, reason: "inactive" };
  if (need === "admin" && user.role !== "admin") return { ok: false, reason: "notAdmin" };
  if (need === "manager" && user.role !== "admin" && user.ordersReferent !== true) return { ok: false, reason: "notAdmin" };
  return { ok: true };
}

/** How much of Admin the session may open: "admin", "referent", or null for none. */
export function adminAccess(user: SessionUser): "admin" | "referent" | null {
  if (!checkAccess(user, "manager").ok) return null;
  return user?.role === "admin" ? "admin" : "referent";
}

// memberId: the account the session works on (orders, balance, history).
// personId: who signed in; the same member unless they joined a family
// (lib/members/family.ts), then the account is the one they joined.
export type SessionClaims = {
  memberId: string;
  personId: string;
  role: string;
  active: true;
  fullName: string;
  /** "Referente ordini": the person's own flag (the Admin area is personal). */
  ordersReferent: boolean;
};

/**
 * What auth() (auth.ts) adds to the session for the member row found for the
 * session email, on every request. null = no session: the member was
 * deactivated or deleted since signing in.
 */
export function sessionClaims(
  member: { memberId: string; role: string; active: boolean; fullName: string; ordersReferent?: boolean } | null | undefined,
): SessionClaims | null {
  if (!member?.active) return null;
  return {
    memberId: member.memberId,
    personId: member.memberId,
    role: member.role,
    active: true,
    fullName: member.fullName,
    ordersReferent: member.ordersReferent === true,
  };
}

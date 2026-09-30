// Pure access decisions shared by middleware.ts, the page guard and the
// Server Action guards in ./session.ts, and the session refresh in auth.ts.
// No imports on purpose: the middleware bundles this file for the edge runtime.

/** The session fields the guards read. auth() reads them from the members table on every request. */
export type SessionUser =
  | {
      email?: string | null;
      role?: unknown;
      active?: unknown;
    }
  | null
  | undefined;

export type AccessDecision =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "inactive" | "notAdmin" };

/** `need: "member"`: any signed-in, active member. `"admin"`: an active member whose role is admin. */
export function checkAccess(user: SessionUser, need: "member" | "admin"): AccessDecision {
  if (!user?.email) return { ok: false, reason: "unauthenticated" };
  // Fail closed: only an explicit `true` from the session refresh counts.
  if (user.active !== true) return { ok: false, reason: "inactive" };
  if (need === "admin" && user.role !== "admin") return { ok: false, reason: "notAdmin" };
  return { ok: true };
}

export type SessionClaims = { memberId: string; role: string; active: true; fullName: string };

/**
 * What auth() (auth.ts) adds to the session for the member row found for the
 * session email, on every request. null = no session: the member was
 * deactivated or deleted since signing in.
 */
export function sessionClaims(
  member: { memberId: string; role: string; active: boolean; fullName: string } | null | undefined,
): SessionClaims | null {
  if (!member?.active) return null;
  return { memberId: member.memberId, role: member.role, active: true, fullName: member.fullName };
}

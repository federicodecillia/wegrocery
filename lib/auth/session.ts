import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActionError } from "@/lib/action-error";
import { t } from "@/lib/i18n";
import { normalizeRole, type AdminAccess, type Role } from "@/lib/roles";
import { adminAccess, checkAccess } from "./access";

export type UserRole = Role | null;
export type AppSession = {
  user: {
    email: string;
    role?: string | null;
    active?: boolean;
    memberId?: string | null;
    // Who signed in, when they work on a family's account (memberId).
    personId?: string | null;
    fullName?: string | null;
    /** "Referente ordini": a limited Admin area (lib/auth/manager.ts). */
    ordersReferent?: boolean;
  };
};

export async function requireUserSession(): Promise<AppSession> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login");
  }

  // auth() returns no session for a member deactivated or deleted since
  // signing in, so they are sent to /login just above. An inactive flag on a live
  // session means this request's member lookup failed: fail closed with an
  // error, since a redirect to /login would loop (the login page sends any
  // session with an email back to /).
  if (!checkAccess(session.user, "member").ok) throw new ActionError(t.errors.unauthorized);

  const u = session.user as {
    role?: string | null;
    active?: boolean;
    memberId?: string | null;
    personId?: string | null;
    fullName?: string | null;
    ordersReferent?: boolean;
  };
  return {
    user: {
      email,
      role: u?.role ?? null,
      active: Boolean(u?.active),
      memberId: u?.memberId ?? null,
      personId: u?.personId ?? u?.memberId ?? null,
      fullName: u?.fullName ?? null,
      ordersReferent: u?.ordersReferent === true,
    },
  };
}

// memberId: the account (a family's, for a person who joined one);
// personId: who signed in; role: the session's (lib/members/family.ts
// familyRole for a person in a family). requireAdmin returns the admin's own
// row as memberId: the admin panel is personal.
export type GuardedMember = {
  email: string;
  memberId: string;
  personId: string;
  role: Role | null;
  /** For the Admin guards: "admin", or "referent" for a "Referente ordini" (requireOrderManager). */
  access?: AdminAccess;
};

/** Server Actions: the signed-in, active member. Throws ActionError(t.errors.unauthorized) otherwise. */
export async function requireActiveMember(): Promise<GuardedMember> {
  return requireAccess("member");
}

/** Server Actions: a signed-in, active admin. Throws ActionError(t.errors.unauthorized) otherwise. */
export async function requireAdmin(): Promise<GuardedMember> {
  return requireAccess("admin");
}

/**
 * Server Actions: an admin or an active "Referente ordini". A referent works
 * only on the cycles their role lets them see: cycle actions go through
 * requireCycleManager (lib/auth/manager.ts), which checks that too.
 */
export async function requireOrderManager(): Promise<GuardedMember & { access: AdminAccess }> {
  const guard = await requireAccess("manager");
  return { ...guard, access: guard.access! };
}

// Same rule as proxy.ts and requireUserSession. `active` and `memberId`
// are re-read from the members table on every request by auth(), so
// a deactivated admin loses access immediately, not at token expiry.
async function requireAccess(need: "member" | "admin" | "manager"): Promise<GuardedMember> {
  const session = await auth();
  const email = session?.user?.email;
  const user = session?.user as
    | { memberId?: string | null; personId?: string | null; role?: string | null }
    | undefined;
  const memberId = user?.memberId;
  if (!email || !memberId || !checkAccess(session?.user, need).ok) throw new ActionError(t.errors.unauthorized);
  const personId = user?.personId ?? memberId;
  const role = normalizeRole(user?.role);
  if (need === "member") return { email, memberId, personId, role };
  // The Admin area is personal: the admin's own row.
  return { email, memberId: personId, personId, role, access: adminAccess(session?.user) ?? undefined };
}

// Legacy stored values ('socio', 'attivo', 'member') come back canonical.
export function getUserRole(session: AppSession): UserRole {
  return normalizeRole(session.user.role);
}

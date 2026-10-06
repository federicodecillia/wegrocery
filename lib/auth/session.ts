import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActionError } from "@/lib/action-error";
import { t } from "@/lib/i18n";
import { normalizeRole, type Role } from "@/lib/roles";
import { checkAccess } from "./access";

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
  };
  return {
    user: {
      email,
      role: u?.role ?? null,
      active: Boolean(u?.active),
      memberId: u?.memberId ?? null,
      personId: u?.personId ?? u?.memberId ?? null,
      fullName: u?.fullName ?? null,
    },
  };
}

// memberId: the account (a family's, for a person who joined one);
// personId: who signed in; role: the session's (lib/members/family.ts
// familyRole for a person in a family). requireAdmin returns the admin's own
// row as memberId: the admin panel is personal.
export type GuardedMember = { email: string; memberId: string; personId: string; role: Role | null };

/** Server Actions: the signed-in, active member. Throws ActionError(t.errors.unauthorized) otherwise. */
export async function requireActiveMember(): Promise<GuardedMember> {
  return requireAccess("member");
}

/** Server Actions: a signed-in, active admin. Throws ActionError(t.errors.unauthorized) otherwise. */
export async function requireAdmin(): Promise<GuardedMember> {
  return requireAccess("admin");
}

// Same rule as proxy.ts and requireUserSession. `active` and `memberId`
// are re-read from the members table on every request by auth(), so
// a deactivated admin loses access immediately, not at token expiry.
async function requireAccess(need: "member" | "admin"): Promise<GuardedMember> {
  const session = await auth();
  const email = session?.user?.email;
  const user = session?.user as
    | { memberId?: string | null; personId?: string | null; role?: string | null }
    | undefined;
  const memberId = user?.memberId;
  if (!email || !memberId || !checkAccess(session?.user, need).ok) throw new ActionError(t.errors.unauthorized);
  const personId = user?.personId ?? memberId;
  const role = normalizeRole(user?.role);
  return { email, memberId: need === "admin" ? personId : memberId, personId, role };
}

// Legacy stored values ('socio', 'attivo', 'member') come back canonical.
export function getUserRole(session: AppSession): UserRole {
  return normalizeRole(session.user.role);
}

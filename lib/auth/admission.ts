import { eq, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/member-email";
import { provisionVerifiedMember, recordMembershipCheck } from "@/lib/membership/members";
import { existingMemberSignIn, newUserSignIn, type LoginError } from "@/lib/membership/policy";
import { checkMembership, checkMembershipAny, isMembershipCheckEnabled, type MembershipResult } from "@/lib/membership/wallyfor";

// Who may sign in with an email address: the decisions of
// lib/membership/policy.ts with the lookups and the WallyFor call around them.
// Used before an email link goes out, when Google hands over an identity, and
// when a session is created (lib/auth/config.ts).

export type Admission =
  | { kind: "member"; memberId: string }
  | { kind: "provision" }
  | { kind: "deny"; error: LoginError };

export type MemberRow = {
  memberId: string;
  fullName: string;
  email: string;
  aliasEmail: string | null;
  role: string;
  active: boolean;
};

// The member an address belongs to, as main email or alias, ignoring case.
export async function findMemberByLoginEmail(email: string): Promise<MemberRow | null> {
  const address = normalizeEmail(email);
  if (!address) return null;
  const [member] = await getDb()
    .select({
      memberId: members.memberId,
      fullName: members.fullName,
      email: members.email,
      aliasEmail: members.aliasEmail,
      role: members.role,
      active: members.active,
    })
    .from(members)
    .where(or(eq(sql`lower(${members.email})`, address), eq(sql`lower(${members.aliasEmail})`, address)))
    .limit(1);
  return member ?? null;
}

// Bookkeeping only: a failed write must not flip the sign-in decision.
async function recordSafely(memberId: string, status: "valid" | "invalid") {
  try {
    await recordMembershipCheck(memberId, status);
  } catch (err) {
    console.error("[auth] could not record membership check", err);
  }
}

// `emailVerified`: whether the address is proven. The email link proves it by
// itself; Google says so in its profile. An unproven address is never
// provisioned.
export async function admitEmail(email: string, opts: { emailVerified: boolean }): Promise<Admission> {
  const address = normalizeEmail(email);
  if (!address) return { kind: "deny", error: "AccessDenied" };
  const member = await findMemberByLoginEmail(address);
  const checkEnabled = isMembershipCheckEnabled();

  let decision = member
    ? existingMemberSignIn(member, checkEnabled, null)
    : newUserSignIn(checkEnabled, null, opts.emailVerified);
  let result: MembershipResult | null = null;
  if (decision.kind === "check") {
    result = member ? await checkMembershipAny([member.email, member.aliasEmail]) : await checkMembership(address);
    decision = member
      ? existingMemberSignIn(member, checkEnabled, result)
      : newUserSignIn(checkEnabled, result, opts.emailVerified);
  }
  if ("logError" in decision && decision.logError && result?.status === "error") {
    console.error(`[auth] membership check unavailable at sign-in: ${result.message}`);
  }

  switch (decision.kind) {
    case "allow":
      if (member && decision.record) await recordSafely(member.memberId, decision.record);
      return member ? { kind: "member", memberId: member.memberId } : { kind: "deny", error: "AccessDenied" };
    case "provision":
      return { kind: "provision" };
    case "deny":
      if (member && decision.record) await recordSafely(member.memberId, decision.record);
      // No member and no card check: simply not one of the group's members.
      return { kind: "deny", error: !member && decision.error === "AccessDenied" ? "NotMember" : decision.error };
    default:
      return { kind: "deny", error: "AccessDenied" };
  }
}

// At session creation: the member behind the address, created now when the
// card check admitted a newcomer. null = no session.
export async function memberForNewSession(email: string, name: string | null): Promise<string | null> {
  const found = await findMemberByLoginEmail(email);
  if (found) return found.active ? found.memberId : null;
  const admission = await admitEmail(email, { emailVerified: true });
  if (admission.kind !== "provision") return null;
  const provisioned = await provisionVerifiedMember(normalizeEmail(email)!, name);
  if (!provisioned.active) return null;
  return (await findMemberByLoginEmail(email))?.memberId ?? null;
}

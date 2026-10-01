// DB side of the membership gate: record a check result, auto-provision a
// verified card holder. Decisions live in ./policy.ts.

import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLog, members } from "@/lib/db/schema";
import { DEFAULT_ROLE } from "@/lib/roles";
import { fullNameFromProfile } from "./policy";

/** Base, least-privileged role given to self-onboarded members. */
export const AUTO_PROVISION_ROLE = DEFAULT_ROLE;

export async function recordMembershipCheck(
  memberId: string,
  status: "valid" | "invalid",
  now: Date = new Date(),
): Promise<void> {
  await getDb()
    .update(members)
    .set({ membershipStatus: status, membershipVerifiedAt: now })
    .where(eq(members.memberId, memberId));
}

/**
 * Creates the member row for a login email whose card WallyFor reported valid.
 * Two concurrent first logins race on the unique email: the loser's insert is
 * a no-op and it re-reads the winner's row. Returns whether the (possibly
 * pre-existing) row is active.
 */
export async function provisionVerifiedMember(
  email: string,
  profileName: string | null | undefined,
  now: Date = new Date(),
): Promise<{ active: boolean }> {
  const db = getDb();
  const memberId = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const inserted = await db
    .insert(members)
    .values({
      memberId,
      fullName: fullNameFromProfile(profileName, email),
      email,
      aliasEmail: null,
      role: AUTO_PROVISION_ROLE,
      active: true,
      membershipStatus: "valid",
      membershipVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    // No target: a concurrent first login may collide on members_email_unique
    // or on the case-insensitive members_email_lower_uniq (migration 0017);
    // either way the other request created the member.
    .onConflictDoNothing()
    .returning({ memberId: members.memberId });

  if (inserted.length > 0) {
    await db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: "system",
      action: "auto_provision_member",
      entityType: "member",
      entityId: memberId,
      payloadJson: JSON.stringify({ email, role: AUTO_PROVISION_ROLE, reason: "membership card verified (WallyFor)" }),
      createdAt: now,
    });
    return { active: true };
  }

  const [existing] = await db
    .select({ active: members.active })
    .from(members)
    .where(or(eq(members.email, email), eq(members.aliasEmail, email)))
    .limit(1);
  return { active: Boolean(existing?.active) };
}

/** Whether the group has an active admin (BOOTSTRAP_ADMIN_EMAIL applies only without one). */
export async function hasActiveAdmin(): Promise<boolean> {
  const rows = await getDb()
    .select({ memberId: members.memberId })
    .from(members)
    .where(and(eq(members.role, "admin"), eq(members.active, true)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Creates the first admin of a new installation for the BOOTSTRAP_ADMIN_EMAIL
 * address. The insert itself checks that no active admin exists, so two first
 * sign-ins at once cannot both become admin. Returns whether it created it.
 */
export async function provisionBootstrapAdmin(email: string, now: Date = new Date()): Promise<boolean> {
  const db = getDb();
  const memberId = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const { rows } = await db.execute<{ member_id: string }>(sql`
    INSERT INTO ${members} (member_id, full_name, email, alias_email, role, active, created_at, updated_at)
    SELECT ${memberId}, ${fullNameFromProfile(null, email)}, ${email}, NULL, 'admin', true, ${now.toISOString()}, ${now.toISOString()}
    WHERE NOT EXISTS (SELECT 1 FROM ${members} WHERE role = 'admin' AND active)
    ON CONFLICT DO NOTHING
    RETURNING member_id`);
  if (rows.length === 0) return false;
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: "system",
    action: "bootstrap_admin",
    entityType: "member",
    entityId: memberId,
    payloadJson: JSON.stringify({ email, role: "admin", reason: "BOOTSTRAP_ADMIN_EMAIL, no admin yet" }),
    createdAt: now,
  });
  return true;
}

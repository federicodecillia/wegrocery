// DB side of the membership gate: record a check result, auto-provision a
// verified card holder. Decisions live in ./policy.ts.

import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLog, members } from "@/lib/db/schema";
import { fullNameFromProfile } from "./policy";

/** Base, non-admin role given to self-onboarded members. */
export const AUTO_PROVISION_ROLE = "socio";

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
    .onConflictDoNothing({ target: members.email })
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

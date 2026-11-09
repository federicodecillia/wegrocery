// DB side of the requests to join ('request' sign-up mode,
// lib/membership/signup.ts): store one, list the pending ones, approve
// (creates the member once, whatever the clicks) or reject.

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { auditLog, membershipRequests, members } from "@/lib/db/schema";
import { REJECTED_RETENTION_DAYS, REQUESTS_PER_IP_PER_HOUR, newRequestId, type ValidRequest } from "./signup";

type Db = ReturnType<typeof getDb>;

/** The requester's IP as stored: an HMAC keyed by AUTH_SECRET, never the address. */
export function hashRequestIp(ip: string, key: string | undefined): string {
  return createHmac("sha256", key || "wegrocery-signup").update(`ip\0${ip}`).digest("hex").slice(0, 32);
}

export type StoreOutcome = "stored" | "duplicate" | "member" | "rate_limited";

/**
 * Stores a request unless the address is already a member, already has a
 * pending request (the partial unique index of 0052 settles a race), or the
 * IP sent too many in the last hour. The caller answers the same way in every
 * case: the page never tells who is a member.
 */
export async function storeMembershipRequest(
  db: Db,
  input: ValidRequest & { ipHash: string; termsVersion: string | null },
  now: Date = new Date(),
): Promise<{ outcome: StoreOutcome; requestId?: string }> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [[recent], [member]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(membershipRequests)
      .where(and(eq(membershipRequests.ipHash, input.ipHash), gte(membershipRequests.createdAt, since))),
    db
      .select({ memberId: members.memberId })
      .from(members)
      .where(sql`lower(${members.email}) = ${input.email} OR lower(${members.aliasEmail}) = ${input.email}`)
      .limit(1),
  ]);
  if ((recent?.n ?? 0) >= REQUESTS_PER_IP_PER_HOUR) return { outcome: "rate_limited" };
  if (member) return { outcome: "member" };
  const requestId = newRequestId();
  const inserted = await db
    .insert(membershipRequests)
    .values({
      requestId,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      note: input.note,
      status: "pending",
      createdAt: now,
      ipHash: input.ipHash,
      termsAcceptedVersion: input.termsVersion,
    })
    .onConflictDoNothing()
    .returning({ requestId: membershipRequests.requestId });
  return inserted.length > 0 ? { outcome: "stored", requestId } : { outcome: "duplicate" };
}

export type PendingRequest = {
  requestId: string;
  email: string;
  fullName: string;
  phone: string | null;
  note: string | null;
  createdAt: Date;
};

export async function listPendingRequests(db: Db): Promise<PendingRequest[]> {
  try {
    return await db
      .select({
        requestId: membershipRequests.requestId,
        email: membershipRequests.email,
        fullName: membershipRequests.fullName,
        phone: membershipRequests.phone,
        note: membershipRequests.note,
        createdAt: membershipRequests.createdAt,
      })
      .from(membershipRequests)
      .where(eq(membershipRequests.status, "pending"))
      .orderBy(asc(membershipRequests.createdAt))
      .limit(200);
  } catch (e) {
    // Before migration 0052 the table is missing: no requests.
    console.error("[signup] could not list requests", e);
    return [];
  }
}

export type ApproveOutcome =
  | { kind: "approved"; memberId: string; email: string; created: boolean }
  | { kind: "gone" };

/**
 * Approves a pending request. One statement: the guarded update (status still
 * 'pending') and the insert of the member, so two admins clicking at once
 * create one member; the second sees "gone". An address that became a member
 * meanwhile is linked to that member instead of creating another.
 */
export async function approveMembershipRequest(
  db: Db,
  input: { requestId: string; adminEmail: string; role: string },
  now: Date = new Date(),
): Promise<ApproveOutcome> {
  const newId = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const at = now.toISOString();
  const { rows } = await db.execute<{ member_id: string; email: string; created: string | null }>(sql`
    WITH req AS (
      UPDATE ${membershipRequests} mr
      SET status = 'approved', decided_at = ${at}, decided_by = ${input.adminEmail},
          member_id = COALESCE(
            (SELECT m.member_id FROM ${members} m
             WHERE lower(m.email) = lower(mr.email) OR lower(m.alias_email) = lower(mr.email)
             LIMIT 1),
            ${newId})
      WHERE mr.request_id = ${input.requestId} AND mr.status = 'pending'
      RETURNING mr.member_id, mr.email, mr.full_name, mr.created_at, mr.terms_accepted_version
    ), ins AS (
      INSERT INTO ${members}
        (member_id, full_name, email, alias_email, role, active, joined_via,
         terms_accepted_at, terms_accepted_version, created_at, updated_at)
      SELECT ${newId}, req.full_name, lower(req.email), NULL, ${input.role}, true, 'request',
             CASE WHEN req.terms_accepted_version IS NULL THEN NULL ELSE req.created_at END,
             req.terms_accepted_version, ${at}, ${at}
      FROM req WHERE req.member_id = ${newId}
      RETURNING member_id
    )
    SELECT req.member_id, req.email, (SELECT member_id FROM ins) AS created FROM req`);
  const [row] = rows;
  if (!row) return { kind: "gone" };
  const created = row.created !== null;
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: input.adminEmail,
    action: "approve_membership_request",
    entityType: "member",
    entityId: row.member_id,
    payloadJson: JSON.stringify({ requestId: input.requestId, role: input.role, created }),
    createdAt: now,
  });
  return { kind: "approved", memberId: row.member_id, email: row.email, created };
}

export async function rejectMembershipRequest(
  db: Db,
  input: { requestId: string; adminEmail: string },
  now: Date = new Date(),
): Promise<boolean> {
  const done = await db
    .update(membershipRequests)
    .set({ status: "rejected", decidedAt: now, decidedBy: input.adminEmail })
    .where(and(eq(membershipRequests.requestId, input.requestId), eq(membershipRequests.status, "pending")))
    .returning({ requestId: membershipRequests.requestId });
  if (done.length === 0) return false;
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: input.adminEmail,
    action: "reject_membership_request",
    entityType: "membership_request",
    entityId: input.requestId,
    payloadJson: JSON.stringify({}),
    createdAt: now,
  });
  return true;
}

/** Rejected requests leave after 30 days (run when an admin opens Soci). Never throws. */
export async function pruneRejectedRequests(db: Db): Promise<void> {
  try {
    await db
      .delete(membershipRequests)
      .where(
        and(
          eq(membershipRequests.status, "rejected"),
          sql`${membershipRequests.decidedAt} < now() - make_interval(days => ${REJECTED_RETENTION_DAYS})`,
        ),
      );
  } catch (e) {
    console.error("[signup] could not prune rejected requests", e);
  }
}

"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireActiveMember, requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { getMemberByEmail, getMemberById } from "@/lib/db/queries";
import { auditLog, familyInvites, members } from "@/lib/db/schema";
import { sendMail } from "@/lib/email/resend";
import { getBrand } from "@/lib/brand/get-brand";
import { notificationEmail } from "@/lib/email/templates";
import { t } from "@/lib/i18n";
import { checkInvite, checkUnlink, inviteExpiry, MAX_FAMILY_SIZE, type InviteRefusal } from "@/lib/members/family";
import type { MergeRefusal } from "@/lib/members/merge";
import { mergeMembers } from "@/lib/members/merge-store";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { getPaymentSettings } from "@/lib/payments/get-settings";

// Families (lib/members/family.ts): a member invites another by address, the
// invited person accepts, and their session uses the inviting account from
// then on. Refusals come back as values: Next.js masks thrown Server Action
// messages in production.

type Result = { error?: string; message?: string };

const r = () => t.family.refusals;

function inviteRefusalMessage(code: InviteRefusal): string {
  return code === "family_full" ? r().family_full(MAX_FAMILY_SIZE) : r()[code];
}

function joinRefusalMessage(refusal: MergeRefusal): string {
  switch (refusal.code) {
    case "both_ordered":
      return r().both_ordered(refusal.cycleTitle);
    case "per_order_open":
      return r().per_order_open(refusal.cycleTitle);
    case "pending_payment":
    case "open_refund":
    case "unsettled_per_order":
      return r()[refusal.code];
    case "in_family":
      return r().already_in_family;
    case "has_family":
      return r().has_family;
    default:
      return r().other;
  }
}

function audit(email: string, action: string, entityId: string, payload: object) {
  return getDb()
    .insert(auditLog)
    .values({
      auditId: crypto.randomUUID(),
      userEmail: email,
      action,
      entityType: "member",
      entityId,
      payloadJson: JSON.stringify(payload),
      createdAt: new Date(),
    });
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

async function familySize(accountId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(members)
    .where(eq(members.householdOf, accountId));
  return 1 + Number(row?.n ?? 0);
}

export async function inviteToFamily(emailInput: string): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const [settings, account, target] = await Promise.all([
      getPaymentSettings(),
      getMemberById(session.memberId),
      getMemberByEmail(emailInput),
    ]);
    if (!account) return { error: t.errors.memberNotFound };
    const db = getDb();
    const [targetPeople, accountSize, pending] = await Promise.all([
      target ? familySize(target.memberId).then((n) => n - 1) : Promise.resolve(0),
      familySize(account.memberId),
      target
        ? db
            .select({ id: familyInvites.inviteId })
            .from(familyInvites)
            .where(
              and(
                eq(familyInvites.accountId, account.memberId),
                eq(familyInvites.memberId, target.memberId),
                eq(familyInvites.status, "pending"),
                sql`${familyInvites.expiresAt} > now()`,
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);
    const refusal = checkInvite({
      enabled: settings.familiesEnabled,
      accountId: account.memberId,
      target,
      targetHouseholdMembers: targetPeople,
      accountSize,
      pendingToTarget: pending.length > 0,
    });
    if (refusal) return { error: inviteRefusalMessage(refusal) };

    const now = new Date();
    const inviteId = crypto.randomUUID();
    try {
      await db.batch([
        // An expired invitation still holds the pending slot of the pair.
        db
          .update(familyInvites)
          .set({ status: "cancelled", respondedAt: now })
          .where(
            and(
              eq(familyInvites.accountId, account.memberId),
              eq(familyInvites.memberId, target!.memberId),
              eq(familyInvites.status, "pending"),
              sql`${familyInvites.expiresAt} <= now()`,
            ),
          ),
        db.insert(familyInvites).values({
          inviteId,
          accountId: account.memberId,
          memberId: target!.memberId,
          invitedBy: session.email,
          status: "pending",
          createdAt: now,
          expiresAt: inviteExpiry(now),
        }),
        db.insert(auditLog).values({
          auditId: crypto.randomUUID(),
          userEmail: session.email,
          action: "family_invite",
          entityType: "member",
          entityId: account.memberId,
          payloadJson: JSON.stringify({ inviteId, accountId: account.memberId, memberId: target!.memberId }),
          createdAt: now,
        }),
      ]);
    } catch (e) {
      if (isUniqueViolation(e)) return { error: r().already_invited };
      throw e;
    }

    // In the app, and by email to the primary address whatever the
    // preferences: it is a request, not news.
    const title = t.family.notificationTitle;
    const body = t.family.notificationBody(account.fullName);
    await dispatchNotification(db, { memberId: target!.memberId, type: "family_invite", title, body, href: "/famiglia" });
    const { subject, text } = notificationEmail({ title, body, href: "/famiglia" }, await getBrand());
    const sent = await sendMail({ to: target!.email, subject, text });
    if ("error" in sent) console.error("[family] invite email not sent:", sent.error);

    revalidatePath("/famiglia");
    return { message: t.family.sent(target!.email) };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "inviteToFamily") };
  }
}

export async function cancelFamilyInvite(inviteId: string): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const done = await getDb()
      .update(familyInvites)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(
        and(
          eq(familyInvites.inviteId, inviteId),
          eq(familyInvites.accountId, session.memberId),
          eq(familyInvites.status, "pending"),
        ),
      )
      .returning({ id: familyInvites.inviteId });
    if (done.length === 0) return { error: r().invite_gone };
    await audit(session.email, "family_invite_cancel", session.memberId, { inviteId });
    revalidatePath("/famiglia");
    return { message: t.family.inviteCancelled };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "cancelFamilyInvite") };
  }
}

export async function declineFamilyInvite(inviteId: string): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const done = await getDb()
      .update(familyInvites)
      .set({ status: "declined", respondedAt: new Date() })
      .where(
        and(
          eq(familyInvites.inviteId, inviteId),
          eq(familyInvites.memberId, session.personId),
          eq(familyInvites.status, "pending"),
        ),
      )
      .returning({ id: familyInvites.inviteId });
    if (done.length === 0) return { error: r().invite_gone };
    await audit(session.email, "family_invite_decline", session.personId, { inviteId });
    revalidatePath("/famiglia");
    return { message: t.family.declined };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "declineFamilyInvite") };
  }
}

// The invited person joins the account: their balance and open-cycle orders
// move there (lib/members/merge-store.ts, mode "link"), their closed history
// stays on their own row, which Storico shows with the family's.
export async function acceptFamilyInvite(inviteId: string): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const db = getDb();
    const [invite] = await db
      .select()
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.inviteId, inviteId),
          eq(familyInvites.memberId, session.personId),
          eq(familyInvites.status, "pending"),
          sql`${familyInvites.expiresAt} > now()`,
        ),
      )
      .limit(1);
    if (!invite) return { error: r().invite_gone };
    const settings = await getPaymentSettings();
    if (!settings.familiesEnabled) return { error: r().disabled };
    if (session.memberId !== session.personId) return { error: r().already_in_family };
    if ((await familySize(invite.accountId)) >= MAX_FAMILY_SIZE) {
      return { error: r().family_full(MAX_FAMILY_SIZE) };
    }

    const { decision } = await mergeMembers(db, {
      survivorId: invite.accountId,
      absorbedId: session.personId,
      actingMemberId: session.personId,
      adminEmail: session.email,
      mode: "link",
      inviteId,
    });
    if (!decision.ok) return { error: joinRefusalMessage(decision.refusal) };

    const [account, person] = await Promise.all([getMemberById(invite.accountId), getMemberById(session.personId)]);
    if (account && person) {
      await dispatchNotification(db, {
        memberId: account.memberId,
        type: "family_joined",
        title: t.family.title,
        body: t.family.joinedBody(person.fullName),
        href: "/famiglia",
      });
    }
    revalidateAll();
    return { message: t.family.accepted(account?.fullName ?? "") };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "acceptFamilyInvite") };
  }
}

// Takes `personId` out of the account they joined. Their own row holds no
// money (it all moved on joining), so nothing moves back: the family keeps
// balance, orders and history.
async function unlink(personId: string, actorEmail: string, action: string, accountId?: string) {
  const db = getDb();
  const now = new Date();
  const where = accountId
    ? and(eq(members.memberId, personId), eq(members.householdOf, accountId))
    : and(eq(members.memberId, personId), sql`${members.householdOf} IS NOT NULL`);
  const [person] = await db.select({ householdOf: members.householdOf }).from(members).where(where).limit(1);
  if (!person) return false;
  const [done] = await db.batch([
    db
      .update(members)
      .set({ householdOf: null, updatedAt: now })
      .where(and(eq(members.memberId, personId), eq(members.householdOf, person.householdOf!)))
      .returning({ id: members.memberId }),
    db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: actorEmail,
      action,
      entityType: "member",
      entityId: personId,
      payloadJson: JSON.stringify({ memberId: personId, accountId: person.householdOf }),
      createdAt: now,
    }),
  ]);
  return done.length > 0;
}

export async function leaveFamily(): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const person = await getMemberById(session.personId);
    if (!person) return { error: t.errors.memberNotFound };
    const refusal = checkUnlink(person, session.personId);
    if (refusal) return { error: r()[refusal] };
    if (!(await unlink(person.memberId, session.email, "family_leave", person.householdOf!))) {
      return { error: t.family.changed };
    }
    revalidateAll();
    return { message: t.family.left };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "leaveFamily") };
  }
}

// The account's own person removes someone who joined it.
export async function removeFromFamily(personId: string): Promise<Result> {
  try {
    const session = await requireActiveMember();
    const person = await getMemberById(personId);
    if (!person) return { error: t.errors.memberNotFound };
    const refusal = checkUnlink(person, session.personId);
    if (refusal) return { error: r()[refusal] };
    if (!(await unlink(person.memberId, session.email, "family_remove", person.householdOf!))) {
      return { error: t.family.changed };
    }
    revalidateAll();
    return { message: t.family.removed(person.fullName) };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "removeFromFamily") };
  }
}

// Admin -> Soci: takes a person out of the family they joined.
export async function adminUnlinkFamilyMember(personId: string): Promise<Result> {
  try {
    const admin = await requireAdmin();
    const person = await getMemberById(personId);
    if (!person) return { error: t.errors.memberNotFound };
    if (!person.householdOf) return { error: r().not_in_family };
    if (!(await unlink(person.memberId, admin.email, "admin_family_unlink"))) return { error: t.family.changed };
    revalidateAll();
    return { message: t.admin.members.familyUnlinked(person.fullName) };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminUnlinkFamilyMember") };
  }
}

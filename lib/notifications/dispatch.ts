// Central notification dispatch. Every notification the server emits goes
// through here so channel preferences (in-app / email) are honoured in one
// place instead of being re-checked at each call site.
//
// This is a plain server module (NOT "use server"): it is imported by the
// Server Actions in lib/actions/* and by the cron route. It never throws for
// delivery problems — a failed email must not roll back the caller's DB work.

import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, notificationPreferences, notifications } from "@/lib/db/schema";
import { notificationEmail } from "@/lib/email/templates";
import { sendMail, sendMailBatch } from "@/lib/email/resend";
import {
  channelsForType,
  resolvePreferences,
  type ChannelPrefs,
  type NotificationCategory,
} from "./categories";

type Db = ReturnType<typeof getDb>;

export type ResolvedPrefs = Record<NotificationCategory, ChannelPrefs>;

function genNotificationId(): string {
  return `not_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// Resolves effective channel preferences for a set of members in a single
// query. Every requested member gets an entry (defaults filled in for those
// with no stored rows), so callers can `.get(id)!` safely.
export async function getResolvedPreferences(
  db: Db,
  memberIds: ReadonlyArray<string>,
): Promise<Map<string, ResolvedPrefs>> {
  const result = new Map<string, ResolvedPrefs>();
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return result;

  const rows = await db
    .select({
      memberId: notificationPreferences.memberId,
      category: notificationPreferences.category,
      appEnabled: notificationPreferences.appEnabled,
      emailEnabled: notificationPreferences.emailEnabled,
    })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.memberId, unique));

  const byMember = new Map<string, { category: string; appEnabled: boolean; emailEnabled: boolean }[]>();
  for (const row of rows) {
    const list = byMember.get(row.memberId) ?? [];
    list.push({ category: row.category, appEnabled: row.appEnabled, emailEnabled: row.emailEnabled });
    byMember.set(row.memberId, list);
  }

  for (const id of unique) {
    result.set(id, resolvePreferences(byMember.get(id) ?? []));
  }
  return result;
}

// member_id → email for a set of members. Used by dispatch paths that need to
// email opted-in members but only hold their IDs.
export async function getMemberEmails(
  db: Db,
  memberIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ memberId: members.memberId, email: members.email })
    .from(members)
    .where(inArray(members.memberId, unique));
  return new Map(rows.map((r) => [r.memberId, r.email]));
}

export type DispatchInput = {
  memberId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  createdAt?: Date;
  // When provided and the member's email channel is on for this type, an email
  // is sent. Omit to skip the email channel (in-app only).
  memberEmail?: string | null;
};

// Single-member dispatch. Inserts an in-app notification when the app channel
// is on, and sends an email when the email channel is on and `memberEmail` was
// given. Pass `prefs` (from getResolvedPreferences) to skip the per-member
// lookup inside a loop. Email failures are logged, never thrown.
export async function dispatchNotification(
  db: Db,
  input: DispatchInput,
  prefs?: ResolvedPrefs,
): Promise<void> {
  const resolved =
    prefs ?? (await getResolvedPreferences(db, [input.memberId])).get(input.memberId)!;
  const channels = channelsForType(input.type, resolved);

  if (channels.app) {
    await db.insert(notifications).values({
      notificationId: genNotificationId(),
      memberId: input.memberId,
      role: null,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      readAt: null,
      createdAt: input.createdAt ?? new Date(),
    });
  }

  if (channels.email && input.memberEmail) {
    const { subject, text } = notificationEmail({
      title: input.title,
      body: input.body,
      href: input.href,
    });
    const result = await sendMail({ to: input.memberEmail, subject, text });
    if ("error" in result) console.error("[notifications] email send failed:", result.error);
  }
}

type BodyItem = {
  memberId: string;
  email?: string | null;
  title: string;
  body: string;
  href?: string | null;
};

// Batch dispatch with per-member bodies (e.g. cycle close, where each member's
// charge differs). One preference query, one batched app-insert, one batched
// email send — each filtered by the member's channels for `type`.
export async function dispatchWithBodies(
  db: Db,
  items: ReadonlyArray<BodyItem>,
  type: string,
  createdAt: Date = new Date(),
): Promise<void> {
  if (items.length === 0) return;
  const prefsByMember = await getResolvedPreferences(db, items.map((i) => i.memberId));

  const appRows = items
    .filter((i) => channelsForType(type, prefsByMember.get(i.memberId)!).app)
    .map((i) => ({
      notificationId: genNotificationId(),
      memberId: i.memberId,
      role: null,
      type,
      title: i.title,
      body: i.body,
      href: i.href ?? null,
      readAt: null,
      createdAt,
    }));
  if (appRows.length > 0) await db.insert(notifications).values(appRows);

  const emailItems = items
    .filter((i) => i.email && channelsForType(type, prefsByMember.get(i.memberId)!).email)
    .map((i) => {
      const { subject, text } = notificationEmail({ title: i.title, body: i.body, href: i.href });
      return { to: i.email as string, subject, text };
    });
  if (emailItems.length > 0) {
    const result = await sendMailBatch(emailItems);
    if ("error" in result) console.error("[notifications] batch email send failed:", result.error);
  }
}

// Batch dispatch with a single shared body for every member (broadcasts:
// cycle opened, closing reminder). Thin wrapper over dispatchWithBodies.
export async function dispatchToMembers(
  db: Db,
  targets: ReadonlyArray<{ memberId: string; email?: string | null }>,
  message: { type: string; title: string; body: string; href?: string | null },
  createdAt: Date = new Date(),
): Promise<void> {
  await dispatchWithBodies(
    db,
    targets.map((tgt) => ({
      memberId: tgt.memberId,
      email: tgt.email,
      title: message.title,
      body: message.body,
      href: message.href,
    })),
    message.type,
    createdAt,
  );
}

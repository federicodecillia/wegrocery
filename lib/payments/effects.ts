import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLog, members } from "@/lib/db/schema";
import { getMemberBalance } from "@/lib/db/queries";
import { formatMoney } from "@/lib/i18n/format";
import { dispatchNotification } from "@/lib/notifications/dispatch";

// What the Stripe handlers do around their writes: ids, audit rows and the
// member's notification with the balance after the change.

export type Db = ReturnType<typeof getDb>;

export function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function audit(db: Db, action: string, entityId: string, payload: unknown): Promise<void> {
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: "stripe",
    action,
    entityType: "payment",
    entityId,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date(),
  });
}

export async function notifyMember(
  db: Db,
  memberId: string,
  type: string,
  title: string,
  body: (balance: string) => string,
): Promise<void> {
  const [member] = await db
    .select({ email: members.email })
    .from(members)
    .where(eq(members.memberId, memberId))
    .limit(1);
  const balance = await getMemberBalance(memberId);
  await dispatchNotification(db, {
    memberId,
    memberEmail: member?.email ?? null,
    type,
    title,
    body: body(formatMoney(balance)),
    href: "/storico",
    createdAt: new Date(),
  });
}

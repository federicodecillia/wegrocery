"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getBrand, getGroupIdentity } from "@/lib/brand/get-brand";
import { checkLogo, mergeOverrides, validateIdentityInput } from "@/lib/brand/identity";
import { getDb } from "@/lib/db/client";
import { auditLog, groupIdentity } from "@/lib/db/schema";
import { getAppBaseUrl } from "@/lib/email/base-url";
import { sendMail } from "@/lib/email/resend";
import { t } from "@/lib/i18n";
import { getStripe } from "@/lib/payments/stripe";
import { checkWebhookEndpoints, type WebhookCheck } from "@/lib/payments/webhook-check";

// The group's identity edited in the app (first-run setup and Impostazioni):
// names, contacts, links and colours over NEXT_PUBLIC_BRAND_JSON, the logo,
// and the end of the first-run setup. Every write is one batch with its audit.

const e = () => t.admin.settings.identity.errors;

// The whole app shows the identity: the layout (colours, title), the header,
// emails, the icons.
function revalidateIdentity() {
  revalidatePath("/", "layout");
}

function audit(email: string, action: string, payload: unknown, now: Date) {
  return getDb().insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: email,
    action,
    entityType: "group_identity",
    entityId: "1",
    payloadJson: JSON.stringify(payload),
    createdAt: now,
  });
}

// Saves the fields of one form (a step of the setup or the Impostazioni card)
// over what is stored: fields not sent stay as they were.
export async function adminUpdateIdentity(input: Record<string, unknown>): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const checked = validateIdentityInput(input);
    if ("error" in checked) return { error: e()[checked.error] };
    // Fields sent empty go back to the brand JSON: drop them from the stored ones.
    const before = (await getGroupIdentity()).overrides;
    const cleared = Object.keys(input).filter((k) => k !== "theme" && !(k in checked.value));
    const kept = Object.fromEntries(Object.entries(before).filter(([k]) => !cleared.includes(k)));
    const after = mergeOverrides(kept, checked.value);
    const now = new Date();
    const db = getDb();
    await db.batch([
      db
        .insert(groupIdentity)
        .values({ id: 1, overrides: after, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({ target: groupIdentity.id, set: { overrides: after, updatedAt: now, updatedBy: admin.email } }),
      audit(admin.email, "update_group_identity", { before, after }, now),
    ]);
    revalidateIdentity();
    return {};
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminUpdateIdentity") };
  }
}

export async function adminUploadLogo(form: FormData): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const file = form.get("logo");
    if (!(file instanceof File)) return { error: e().logoEmpty };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = checkLogo(bytes);
    if ("error" in checked) return { error: e()[checked.error] };
    const now = new Date();
    const logo = { logoBase64: Buffer.from(bytes).toString("base64"), logoType: checked.type, logoUpdatedAt: now };
    const db = getDb();
    await db.batch([
      db
        .insert(groupIdentity)
        .values({ id: 1, overrides: {}, ...logo, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({ target: groupIdentity.id, set: { ...logo, updatedAt: now, updatedBy: admin.email } }),
      audit(admin.email, "upload_group_logo", { type: checked.type, bytes: bytes.length }, now),
    ]);
    revalidateIdentity();
    return {};
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminUploadLogo") };
  }
}

export async function adminRemoveLogo(): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const now = new Date();
    const db = getDb();
    await db.batch([
      db
        .update(groupIdentity)
        .set({ logoBase64: null, logoType: null, logoUpdatedAt: null, updatedAt: now, updatedBy: admin.email })
        .where(eq(groupIdentity.id, 1)),
      audit(admin.email, "remove_group_logo", {}, now),
    ]);
    revalidateIdentity();
    return {};
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminRemoveLogo") };
  }
}

export async function adminCompleteSetup(): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const now = new Date();
    const db = getDb();
    await db.batch([
      db
        .insert(groupIdentity)
        .values({ id: 1, overrides: {}, setupCompletedAt: now, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: groupIdentity.id,
          set: { setupCompletedAt: sql`coalesce(${groupIdentity.setupCompletedAt}, ${now.toISOString()}::timestamptz)` },
        }),
      audit(admin.email, "complete_setup", {}, now),
    ]);
    revalidatePath("/admin");
    revalidatePath("/");
    return {};
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminCompleteSetup") };
  }
}

const TEST_EMAILS_PER_HOUR = 3;

// Sends a test email to the admin's own address: proves the key, the sender
// and the domain before members try to sign in. Outside production it goes
// where every email goes there (EMAIL_REDIRECT_TO).
export async function adminSendTestEmail(): Promise<{ error?: string; to?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const now = new Date();
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "setup_test_email"),
          eq(auditLog.userEmail, admin.email),
          gte(auditLog.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
        ),
      );
    if (n >= TEST_EMAILS_PER_HOUR) return { error: t.admin.setup.checks.testEmailLimit };
    const brand = await getBrand();
    const s = t.admin.setup.checks;
    await audit(admin.email, "setup_test_email", {}, now);
    const sent = await sendMail({ to: admin.email, subject: s.testEmailSubject(brand.appName), text: s.testEmailBody(brand.appName) });
    if ("error" in sent) return { error: sent.error };
    return { to: admin.email };
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminSendTestEmail") };
  }
}

export type StripeSetupCheck = WebhookCheck | { status: "off" } | { status: "unverifiable" } | { status: "noBaseUrl" };

// Reads the webhook endpoints with the deploy's key (nothing is stored) and
// compares the one pointing at this app with the events it needs.
export async function adminCheckStripeWebhook(): Promise<StripeSetupCheck> {
  await requireAdmin();
  const stripe = getStripe();
  if (!stripe) return { status: "off" };
  const base = getAppBaseUrl();
  if (!base) return { status: "noBaseUrl" };
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    return checkWebhookEndpoints(list.data, `${base}/api/stripe/webhook`);
  } catch {
    // A restricted key without Webhook Endpoints: Read, or Stripe unreachable.
    return { status: "unverifiable" };
  }
}

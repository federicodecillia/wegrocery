"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getBrand } from "@/lib/brand/get-brand";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { mustAcceptTerms } from "@/lib/members/terms";
import { hashRequestIp, storeMembershipRequest } from "@/lib/membership/requests";
import { isBotSubmission, validateRequest, type RequestInput, type RequestRefusal } from "@/lib/membership/signup";
import { dispatchToMembers } from "@/lib/notifications/dispatch";
import { reportError } from "@/lib/observability";
import { getPaymentSettings } from "@/lib/payments/get-settings";

// /aderisci, without a session: a request to join in 'request' sign-up mode
// (lib/membership/signup.ts). The answer is the same whether the address is
// new, already a member, already waiting or over the hourly limit, so the
// form never tells who belongs to the group.

export type SignupRequestResult = { ok: true } | { ok: false; field: RequestRefusal | "closed" | "unexpected" };

function clientIp(h: Headers): string {
  const raw = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "";
  return raw.split(",")[0]?.trim() || "unknown";
}

export async function submitMembershipRequest(input: RequestInput): Promise<SignupRequestResult> {
  try {
    const [settings, brand] = await Promise.all([getPaymentSettings(), getBrand()]);
    if (settings.signupMode !== "request") return { ok: false, field: "closed" };
    const raw: RequestInput = {
      fullName: String(input?.fullName ?? ""),
      email: String(input?.email ?? ""),
      phone: String(input?.phone ?? ""),
      note: String(input?.note ?? ""),
      website: String(input?.website ?? ""),
      acceptTerms: input?.acceptTerms === true,
    };
    if (isBotSubmission(raw)) return { ok: true };
    // A newcomer accepts the terms on the form when the group asks members to.
    const termsNeeded = mustAcceptTerms(settings, brand, null);
    const valid = validateRequest(raw, termsNeeded);
    if (!valid.ok) return { ok: false, field: valid.field };

    const db = getDb();
    const stored = await storeMembershipRequest(db, {
      ...valid.value,
      ipHash: hashRequestIp(clientIp(await headers()), process.env.AUTH_SECRET),
      termsVersion: termsNeeded ? settings.termsVersion : null,
    });
    if (stored.outcome === "stored") await notifyAdmins(db, valid.value.fullName);
    return { ok: true };
  } catch (e) {
    reportError("signup request", e);
    return { ok: false, field: "unexpected" };
  }
}

// In the app only (an unknown notification type is never emailed,
// lib/notifications/categories.ts): no email quota spent per request.
async function notifyAdmins(db: ReturnType<typeof getDb>, fullName: string): Promise<void> {
  try {
    const admins = await db
      .select({ memberId: members.memberId })
      .from(members)
      .where(and(eq(members.role, "admin"), eq(members.active, true)));
    const n = t.admin.members.requests.notification;
    await dispatchToMembers(db, admins, {
      type: "membership_request",
      title: n.title,
      body: n.body(fullName),
      href: "/admin?tab=soci#richieste",
    });
  } catch (e) {
    reportError("signup notify", e);
  }
}

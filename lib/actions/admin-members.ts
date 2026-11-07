"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuthInstance } from "@/auth";
import { admitEmail } from "@/lib/auth/admission";
import { approveMembershipRequest, rejectMembershipRequest } from "@/lib/membership/requests";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { auditLog, memberDuplicateDismissals } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { pairKey } from "@/lib/members/duplicates";
import { aliasOptions, planMemberMerge, type MergeRefusal } from "@/lib/members/merge";
import { mergeMembers, readMergeState } from "@/lib/members/merge-store";

// Admin -> Members -> Merge (rules in lib/members/merge.ts). Refusals come
// back as values: Next.js masks thrown Server Action messages in production.

function refusalMessage(r: MergeRefusal): string {
  const m = t.admin.members.merge.refusals;
  switch (r.code) {
    case "already_merged":
      return m.already_merged(r.fullName);
    case "both_ordered":
      return m.both_ordered(r.cycleTitle);
    case "per_order_open":
      return m.per_order_open(r.cycleTitle);
    case "in_family":
      return m.in_family(r.fullName);
    case "has_family":
      return m.has_family(r.fullName);
    default:
      return m[r.code];
  }
}

export type MergePreview = {
  survivorName: string;
  absorbedName: string;
  aliasOptions: string[];
  alias: string | null;
  droppedAddresses: string[];
  movedCycleTitles: string[];
  // Formatted, null when the balance is zero.
  transfer: string | null;
  deleteAbsorbed: boolean;
};

export async function previewMemberMerge(
  survivorId: string,
  absorbedId: string,
  alias?: string | null,
): Promise<{ error?: string; preview?: MergePreview }> {
  try {
    const admin = await requireAdmin();
    const snapshot = await readMergeState(getDb(), survivorId, absorbedId, admin.memberId);
    if (!snapshot) return { error: t.errors.memberNotFound };
    const { state } = snapshot;
    const decision = planMemberMerge(state, alias);
    if (!decision.ok) return { error: refusalMessage(decision.refusal) };
    const { plan } = decision;
    return {
      preview: {
        survivorName: state.survivor.fullName,
        absorbedName: state.absorbed.fullName,
        aliasOptions: aliasOptions(state.survivor, state.absorbed),
        alias: plan.survivorAlias,
        droppedAddresses: plan.droppedAddresses,
        movedCycleTitles: state.absorbedOrderCycles
          .filter((c) => plan.moveCycleIds.includes(c.cycleId))
          .map((c) => c.title),
        transfer: plan.transferCents === 0 ? null : formatMoney(plan.transferCents / 100),
        deleteAbsorbed: plan.deleteAbsorbed,
      },
    };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "previewMemberMerge") };
  }
}

export async function adminMergeMembers(
  survivorId: string,
  absorbedId: string,
  alias: string | null,
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const { decision } = await mergeMembers(getDb(), {
      survivorId,
      absorbedId,
      alias,
      actingMemberId: admin.memberId,
      adminEmail: admin.email,
    });
    if (!decision.ok) return { error: refusalMessage(decision.refusal) };
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/storico");
    revalidatePath("/ordine");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminMergeMembers") };
  }
}

// Possible duplicates (lib/members/duplicates.ts): "not the same person", the
// pair is not proposed again.
export async function adminDismissDuplicate(memberA: string, memberB: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (!memberA || !memberB || memberA === memberB) return { error: t.errors.memberNotFound };
    const [a, b] = pairKey(memberA, memberB);
    const db = getDb();
    await db.batch([
      db
        .insert(memberDuplicateDismissals)
        .values({ memberA: a, memberB: b, dismissedBy: admin.email, dismissedAt: new Date() })
        .onConflictDoNothing(),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "dismiss_duplicate_members",
        entityType: "member",
        entityId: a,
        payloadJson: JSON.stringify({ memberA: a, memberB: b }),
        createdAt: new Date(),
      }),
    ]);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminDismissDuplicate") };
  }
}

// Soci -> Richieste in attesa ('request' sign-up mode, lib/membership/
// requests.ts). Approving creates the member with the role of Impostazioni
// and sends the invitation link, as Soci -> Invita; an address that is a
// member already is only linked. "gone": another admin decided first.
export async function adminApproveRequest(
  requestId: string,
): Promise<{ error?: string; message?: string }> {
  try {
    const admin = await requireAdmin();
    const r = t.admin.members.requests;
    if (typeof requestId !== "string" || !requestId) return { error: r.gone };
    const settings = await getPaymentSettings();
    const outcome = await approveMembershipRequest(getDb(), {
      requestId,
      adminEmail: admin.email,
      role: settings.signupRole,
    });
    revalidatePath("/admin");
    if (outcome.kind === "gone") return { error: r.gone };
    if (!outcome.created) return { message: r.linked };
    // The link goes out only if the address may sign in, like Soci -> Invita.
    const admission = await admitEmail(outcome.email, { emailVerified: true });
    if (admission.kind === "deny") return { message: r.approvedNoLink };
    await getAuthInstance().api.signInMagicLink({
      body: { email: outcome.email, callbackURL: "/", metadata: { invite: true } },
      headers: await headers(),
    });
    return { message: r.approved };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminApproveRequest") };
  }
}

// The reason, if any, stays with the admin: nothing is sent to the requester.
export async function adminRejectRequest(requestId: string): Promise<{ error?: string; message?: string }> {
  try {
    const admin = await requireAdmin();
    const r = t.admin.members.requests;
    if (typeof requestId !== "string" || !requestId) return { error: r.gone };
    const done = await rejectMembershipRequest(getDb(), { requestId, adminEmail: admin.email });
    revalidatePath("/admin");
    return done ? { message: r.rejected } : { error: r.gone };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminRejectRequest") };
  }
}

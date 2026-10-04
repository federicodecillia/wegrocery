"use server";

import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
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

"use server";

import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { appSettings, auditLog } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { planPaymentSettingsUpdate, type PaymentSettingsInput } from "@/lib/payments/settings";

// Impostazioni tab: saves the payment settings (the single app_settings row)
// and audits them before and after, in one batch. The payment mode is not
// editable yet: it keeps its default 'wallet' until pay-per-order ships (B2).
export async function adminUpdatePaymentSettings(input: PaymentSettingsInput): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    const planned = planPaymentSettingsUpdate(input, before.stripeKey);
    if ("error" in planned) return { error: t.admin.settings.errors[planned.error] };

    const db = getDb();
    const now = new Date();
    const changes = { ...planned.values, updatedAt: now, updatedBy: admin.email };
    await db.batch([
      db
        .insert(appSettings)
        .values({ id: 1, ...changes })
        .onConflictDoUpdate({ target: appSettings.id, set: changes }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "update_payment_settings",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({
          // `defaults`: no admin had saved yet, these were the brand values.
          before: {
            defaults: before.savedAt === null,
            minBalance: before.minBalance === null ? null : before.minBalance.toFixed(2),
            maxBalance: before.maxBalance === null ? null : before.maxBalance.toFixed(2),
            bankTransferEnabled: before.bankTransferEnabled,
            bankHolder: before.bankHolder,
            bankIban: before.bankIban,
            onlinePaymentsEnabled: before.onlinePaymentsEnabled,
          },
          after: planned.values,
        }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/admin");
    revalidatePath("/ricarica");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminUpdatePaymentSettings") };
  }
}

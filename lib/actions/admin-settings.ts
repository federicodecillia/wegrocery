"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { appSettings, auditLog } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { brand } from "@/lib/brand";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import {
  modeChangeBlockers,
  readModeChangeState,
  runningCyclesSql,
  unsettledCyclesSql,
} from "@/lib/payments/mode-change";
import { planPaymentSettingsUpdate, type PaymentMode, type PaymentSettingsInput } from "@/lib/payments/settings";

// Impostazioni tab: saves the payment settings (the single app_settings row)
// and audits them before and after, in one batch. The payment mode has its
// own action below (adminChangePaymentMode).
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

// Switches the group between wallet and pay-per-order (lib/payments/
// mode-change.ts has the rules). One batch: a guard that re-checks that no
// cycle is running or left unsettled, the new mode, and the audit with the
// balances as they were. Each cycle keeps the mode it was created with.
export async function adminChangePaymentMode(target: PaymentMode): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    if (before.mode === target) return {};
    const db = getDb();
    const state = await readModeChangeState(db);
    const blockers = modeChangeBlockers({
      target,
      currency: brand.currency,
      stripeUsable: before.stripeKey.usable,
      runningCycles: state.runningCycles,
      unsettledCycles: state.unsettledCycles,
    });
    if (blockers.length > 0) return { error: t.admin.settings.mode.blockers[blockers[0]] };

    const now = new Date();
    // No row yet: the defaults the group runs on are stored with the mode.
    const current = {
      minBalance: before.minBalance === null ? null : before.minBalance.toFixed(2),
      maxBalance: before.maxBalance === null ? null : before.maxBalance.toFixed(2),
      bankTransferEnabled: before.bankTransferEnabled,
      bankHolder: before.bankHolder,
      bankIban: before.bankIban,
      onlinePaymentsEnabled: before.onlinePaymentsEnabled,
    };
    try {
      await db.batch([
        db.execute(sql`SELECT 1 / (CASE WHEN ${runningCyclesSql} = 0 AND ${unsettledCyclesSql} = 0
          THEN 1 ELSE 0 END) AS mode_guard`),
        db
          .insert(appSettings)
          .values({ id: 1, ...current, paymentMode: target, updatedAt: now, updatedBy: admin.email })
          .onConflictDoUpdate({
            target: appSettings.id,
            set: { paymentMode: target, updatedAt: now, updatedBy: admin.email },
          }),
        db.insert(auditLog).values({
          auditId: crypto.randomUUID(),
          userEmail: admin.email,
          action: "change_payment_mode",
          entityType: "app_settings",
          entityId: "1",
          payloadJson: JSON.stringify({ before: before.mode, after: target, balances: state }),
          createdAt: now,
        }),
      ]);
    } catch (e) {
      if (e instanceof Error && /22012|division by zero/i.test(e.message)) {
        return { error: t.admin.settings.mode.blockers.running_cycles };
      }
      throw e;
    }
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminChangePaymentMode") };
  }
}

// Impostazioni -> Famiglie: members may invite each other into one account
// (lib/actions/family.ts). Switching off stops new invitations and joins;
// families already formed stay as they are.
export async function adminSetFamiliesEnabled(enabled: boolean): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    if (before.familiesEnabled === enabled) return {};
    const db = getDb();
    const now = new Date();
    // No row yet: the defaults the group runs on are stored with the switch.
    const current = {
      minBalance: before.minBalance === null ? null : before.minBalance.toFixed(2),
      maxBalance: before.maxBalance === null ? null : before.maxBalance.toFixed(2),
      bankTransferEnabled: before.bankTransferEnabled,
      bankHolder: before.bankHolder,
      bankIban: before.bankIban,
      onlinePaymentsEnabled: before.onlinePaymentsEnabled,
    };
    await db.batch([
      db
        .insert(appSettings)
        .values({ id: 1, ...current, familiesEnabled: enabled, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { familiesEnabled: enabled, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_families_enabled",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.familiesEnabled, after: enabled }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetFamiliesEnabled") };
  }
}

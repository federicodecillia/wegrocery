"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { appSettings, auditLog, guideSearchMisses } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { brand } from "@/lib/brand";
import { GROUP_INFO_MAX, normalizeGroupInfo } from "@/lib/guide/group-info";
import { isNamePromptMode, type NamePromptMode } from "@/lib/members/name";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import {
  modeChangeBlockers,
  readModeChangeState,
  runningCyclesSql,
  unsettledCyclesSql,
} from "@/lib/payments/mode-change";
import { cardCyclesAvailable } from "@/lib/payments/cycle-mode";
import {
  isNewCyclePaymentChoice,
  newCyclePaymentColumns,
  planNewCycleDefaults,
  type ModeDefaultsInput,
  type NewCyclePaymentChoice,
} from "@/lib/payments/new-cycle-defaults";
import {
  canEnableWalletTopups,
  planPaymentSettingsUpdate,
  type PaymentMode,
  type PaymentSettingsInput,
} from "@/lib/payments/settings";

// Impostazioni tab: saves the payment settings (the single app_settings row)
// and audits them before and after, in one batch. The payment mode has its
// own action below (adminChangePaymentMode).
export async function adminUpdatePaymentSettings(input: PaymentSettingsInput): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    const planned = planPaymentSettingsUpdate(
      input,
      before.stripeKey,
      before.mode === "wallet" && !before.walletTopupsEnabled,
    );
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
            bankReferenceTemplate: before.bankReferenceTemplate,
            bankReceiptEmail: before.bankReceiptEmail,
            onlinePaymentsEnabled: before.onlinePaymentsEnabled,
          },
          after: planned.values,
        }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/admin");
    revalidatePath("/ricarica");
    revalidatePath("/storico");
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

// Impostazioni -> Saldo del borsellino nei pagamenti con carta: whether a
// card payment also pays the wallet debt or uses the wallet credit
// (orderPaymentAmount, lib/payments/order-payment.ts). Payments already made
// do not change.
export async function adminSetCardSettlesWallet(enabled: boolean): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    if (before.cardSettlesWallet === enabled) return {};
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
        .values({ id: 1, ...current, cardSettlesWallet: enabled, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { cardSettlesWallet: enabled, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_card_settles_wallet",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.cardSettlesWallet, after: enabled }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetCardSettlesWallet") };
  }
}

// Impostazioni -> Borsellino: whether members may top up the wallet (bank
// transfer, online). Off for a wallet group that collects every order by
// card; balances and the ledger do not change, and the admin can still record
// a transfer in Cassa. Back on only with a channel on (wallet_channel_check).
export async function adminSetWalletTopups(enabled: boolean): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    if (before.walletTopupsEnabled === enabled) return {};
    if (enabled && !canEnableWalletTopups(before)) return { error: t.admin.settings.errors.noChannel };
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
        .values({ id: 1, ...current, walletTopupsEnabled: enabled, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { walletTopupsEnabled: enabled, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_wallet_topups",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.walletTopupsEnabled, after: enabled }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetWalletTopups") };
  }
}

// Impostazioni -> Nome e cognome dei soci: whether members named after their
// address are asked for a real name after signing in (lib/members/name.ts).
export async function adminSetMemberNamePrompt(mode: NamePromptMode): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (!isNamePromptMode(mode)) return { error: t.errors.genericError };
    const before = await getPaymentSettings();
    if (before.memberNamePrompt === mode) return {};
    const db = getDb();
    const now = new Date();
    // No row yet: the defaults the group runs on are stored with the choice.
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
        .values({ id: 1, ...current, memberNamePrompt: mode, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { memberNamePrompt: mode, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_member_name_prompt",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.memberNamePrompt, after: mode }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetMemberNamePrompt") };
  }
}

// Impostazioni -> Il nostro gruppo: the group's own text at the top of the
// guide (lib/guide/group-info.ts). An empty text removes the card.
export async function adminUpdateGroupInfo(raw: string): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const text = normalizeGroupInfo(raw);
    if (text !== null && text.length > GROUP_INFO_MAX) {
      return { error: t.admin.settings.groupInfo.tooLong(GROUP_INFO_MAX) };
    }
    const before = await getPaymentSettings();
    if (before.groupInfo === text) return {};
    const db = getDb();
    const now = new Date();
    // No row yet: the defaults the group runs on are stored with the text.
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
        .values({ id: 1, ...current, groupInfo: text, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { groupInfo: text, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "update_group_info",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.groupInfo, after: text }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/guida");
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminUpdateGroupInfo") };
  }
}

// Impostazioni → "Ricerche senza risultati": empty the list (once the group
// has added what was missing).
export async function adminClearGuideSearchMisses(): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    await db.batch([
      db.delete(guideSearchMisses),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "clear_guide_search_misses",
        entityType: "guide_search_misses",
        entityId: "all",
        payloadJson: null,
        createdAt: new Date(),
      }),
    ]);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminClearGuideSearchMisses") };
  }
}

// The stored row's required columns, for an insert when no admin saved yet:
// the defaults the group runs on are stored with the new value.
function settingsRowOf(before: Awaited<ReturnType<typeof getPaymentSettings>>) {
  return {
    minBalance: before.minBalance === null ? null : before.minBalance.toFixed(2),
    maxBalance: before.maxBalance === null ? null : before.maxBalance.toFixed(2),
    bankTransferEnabled: before.bankTransferEnabled,
    bankHolder: before.bankHolder,
    bankIban: before.bankIban,
    onlinePaymentsEnabled: before.onlinePaymentsEnabled,
  };
}

// Impostazioni -> Come si pagano i nuovi cicli, in a wallet group: wallet
// only, wallet with Carta on request, or Carta preselected
// (lib/payments/new-cycle-defaults.ts). Allowed with cycles running: each
// cycle keeps the mode it was created with, only "Nuovo ciclo" changes.
export async function adminSetNewCyclePayment(choice: NewCyclePaymentChoice): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (!isNewCyclePaymentChoice(choice)) return { error: t.errors.genericError };
    const before = await getPaymentSettings();
    const available = cardCyclesAvailable({
      groupMode: before.mode,
      stripeUsable: before.stripeKey.usable,
      currency: brand.currency,
    });
    if (before.mode !== "wallet") return { error: t.errors.genericError };
    if (choice !== "wallet_only" && !available) return { error: t.errors.cyclePaymentModeUnavailable };
    const columns = newCyclePaymentColumns(choice);
    if (before.cardCyclesEnabled === columns.cardCyclesEnabled && before.newCycleMode === columns.newCyclePaymentMode) {
      return {};
    }
    const db = getDb();
    const now = new Date();
    await db.batch([
      db
        .insert(appSettings)
        .values({ id: 1, ...settingsRowOf(before), ...columns, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { ...columns, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_new_cycle_payment",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({
          before: { cardCyclesEnabled: before.cardCyclesEnabled, newCyclePaymentMode: before.newCycleMode },
          after: columns,
        }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetNewCyclePayment") };
  }
}

// Impostazioni -> Spese predefinite dei nuovi cicli: per payment mode, the
// shipping and preparation fee "Nuovo ciclo" starts from. Cycles already
// created keep theirs.
export async function adminSetNewCycleDefaults(
  input: Partial<Record<PaymentMode, ModeDefaultsInput>>,
): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    const before = await getPaymentSettings();
    const plan = planNewCycleDefaults(before.newCycleDefaults, input);
    if ("error" in plan) {
      return {
        error: plan.error.field === "fee" ? t.errors.handlingFeeInvalid : t.admin.settings.newCycles.shippingInvalid,
      };
    }
    const db = getDb();
    const now = new Date();
    await db.batch([
      db
        .insert(appSettings)
        .values({ id: 1, ...settingsRowOf(before), newCycleDefaults: plan.defaults, updatedAt: now, updatedBy: admin.email })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: { newCycleDefaults: plan.defaults, updatedAt: now, updatedBy: admin.email },
        }),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "set_new_cycle_defaults",
        entityType: "app_settings",
        entityId: "1",
        payloadJson: JSON.stringify({ before: before.newCycleDefaults, after: plan.defaults }),
        createdAt: now,
      }),
    ]);
    revalidatePath("/admin");
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "adminSetNewCycleDefaults") };
  }
}

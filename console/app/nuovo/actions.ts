"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/session";
import { audit, getInstance } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { instances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendConsoleMail } from "@/lib/mail";
import { handoverSubject, handoverText } from "@/lib/provisioning/handover";
import * as runner from "@/lib/provisioning/runner";
import type { Result } from "@/lib/provisioning/runner";
import { reportError, userMessage } from "@/lib/report-error";

// Thin wrappers: re-check the operator session, run the step, refresh the
// wizard page. Form states never echo a secret back to the page.

export interface FormState {
  error: string | null;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string) => text(form, key) || null;

async function guarded<T extends object>(where: string, fn: () => Promise<Result<T>>, instanceId?: string): Promise<Result<T>> {
  try {
    await assertOperator();
    const r = await fn();
    if (instanceId) revalidatePath("/nuovo");
    return r;
  } catch (e) {
    reportError(where, e);
    return { ok: false, error: userMessage(e) };
  }
}

const stepUrl = (id: string) => `/nuovo?istanza=${id}`;

export async function saveRegistryAction(instanceId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const r = await guarded("save_registry", () =>
    runner.saveRegistry(instanceId, {
      name: text(form, "name"),
      slug: text(form, "slug"),
      adminEmail: text(form, "adminEmail"),
      locale: form.get("locale") === "en" ? "en" : "it",
      currency: text(form, "currency").toUpperCase(),
      timeZone: text(form, "timeZone"),
      hostingModel: form.get("hostingModel") === "group_owned" ? "group_owned" : "managed",
      vercelTeamId: optional(form, "vercelTeamId"),
      vercelTeamSlug: optional(form, "vercelTeamSlug"),
      neonOrgId: optional(form, "neonOrgId"),
      requestId: optional(form, "requestId"),
    }),
  );
  if (!r.ok) return { error: r.error };
  redirect(stepUrl(r.instanceId));
}

export async function saveIdentityAction(instanceId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const r = await guarded(
    "save_identity",
    () =>
      runner.saveIdentity(instanceId, {
        appName: text(form, "appName"),
        shortName: text(form, "shortName"),
        primary: optional(form, "primary"),
        accent: optional(form, "accent"),
        logoUrl: optional(form, "logoUrl"),
      }),
    instanceId,
  );
  if (!r.ok) return { error: r.error };
  redirect(stepUrl(instanceId));
}

export async function createDatabaseAction(instanceId: string) {
  return guarded("create_database", () => runner.createDatabase(instanceId), instanceId);
}

export async function createAppAction(instanceId: string) {
  return guarded("create_app", () => runner.createApp(instanceId), instanceId);
}

export async function chooseEmailModeAction(instanceId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const mode = form.get("emailMode") === "shared_domain" ? "shared_domain" : "group_domain";
  const r = await guarded("email_mode", () => runner.chooseEmailMode(instanceId, mode, optional(form, "emailDomain")), instanceId);
  return { error: r.ok ? null : r.error };
}

export async function createEmailDomainAction(instanceId: string) {
  return guarded("email_domain", () => runner.createEmailDomain(instanceId), instanceId);
}

export async function verifyEmailDomainAction(instanceId: string) {
  return guarded("email_verify", () => runner.verifyEmailDomain(instanceId), instanceId);
}

export async function finishEmailAction(instanceId: string) {
  return guarded("email_finish", () => runner.finishEmail(instanceId), instanceId);
}

export async function configureStripeAction(instanceId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const r = await guarded("stripe", () => runner.configureStripe(instanceId, text(form, "stripeKey")), instanceId);
  return { error: r.ok ? null : r.error };
}

export async function skipStepAction(instanceId: string, step: "pagamenti" | "dominio") {
  return guarded("skip", () => runner.skipStep(instanceId, step), instanceId);
}

export async function startPublishAction(instanceId: string) {
  return guarded("publish_start", () => runner.startPublish(instanceId), instanceId);
}

export async function checkPublishAction(instanceId: string) {
  return guarded("publish_check", () => runner.checkPublish(instanceId), instanceId);
}

export async function addDomainAction(instanceId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const r = await guarded("domain", () => runner.addCustomDomain(instanceId, text(form, "domain")), instanceId);
  return { error: r.ok ? null : r.error };
}

export async function sendHandoverAction(instanceId: string): Promise<Result<{ message?: string }>> {
  return guarded<{ message?: string }>(
    "handover_mail",
    async (): Promise<Result<{ message?: string }>> => {
      const instance = await getInstance(instanceId);
      if (!instance?.wizard.adminEmail) return { ok: false, error: "Manca l'email del primo admin." };
      const sent = await sendConsoleMail(
        instance.wizard.adminEmail,
        handoverSubject(instance.name),
        handoverText({
          groupName: instance.name,
          appUrl: instance.url,
          adminEmail: instance.wizard.adminEmail,
          emailOnSharedDomain: instance.wizard.emailMode === "shared_domain",
          paymentsConfigured: Boolean(instance.wizard.paymentsConfigured),
        }),
      );
      if (!sent) return { ok: false, error: "Email non inviata: RESEND_API_KEY e MAIL_FROM della console sono impostate?" };
      await getDb()
        .update(instances)
        .set({ wizard: { ...instance.wizard, handoverSentAt: new Date().toISOString() } })
        .where(eq(instances.id, instanceId));
      await audit("handover_mail", instanceId, null);
      return { ok: true, message: `Inviata a ${instance.wizard.adminEmail}.` };
    },
    instanceId,
  );
}

export async function completeHandoverAction(instanceId: string) {
  const r = await guarded("handover", () => runner.completeHandover(instanceId), instanceId);
  if (r.ok) redirect(`/istanze/${instanceId}`);
  return r;
}

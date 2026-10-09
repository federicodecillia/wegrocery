import { eq } from "drizzle-orm";
import { getDb, newId } from "@/lib/db/client";
import { audit, getInstance, getInstanceBySlug, listSteps, setStep } from "@/lib/db/queries";
import { instances, requests, type Instance, type WizardState } from "@/lib/db/schema";
import { brandErrors, brandJsonString } from "@/lib/brand/build";
import { evaluateDeploy, type DeployPhase } from "@/lib/deploy-check";
import { env } from "@/lib/env";
import { refreshInstance, wegroceryRepoId } from "@/lib/fleet/refresh";
import { ProviderError } from "@/lib/http";
import { mailFrom, type DnsRecord } from "@/lib/providers/resend";
import { classifyStripeKey, stripeClient, webhookUrl } from "@/lib/providers/stripe";
import { productionAlias, type ProjectDomain } from "@/lib/providers/vercel";
import { reportError, userMessage } from "@/lib/report-error";
import { vercelProjectName } from "@/lib/slug";
import { sealStatsSecret } from "@/lib/stats-secret";
import { neonFor, resendForProvisioning, vercelFor } from "./clients";
import { registryErrors, type RegistryInput } from "./registry";
import { appEnvVars, baseUrlEnvVar, emailEnvVars, envKeys, randomSecret, stripeEnvVars } from "./env-plan";
import { appPlan, canReopen, canRun, databasePlan, stepStates, type StepId } from "./steps";

// The wizard's effects. Every function is idempotent and resumable: it reads
// what the registry already knows (ids of created resources) and does only
// what is missing. Secrets (database URL, auth secret, keys) go straight
// from a provider or the generator to Vercel and are never stored or logged;
// the only exception is INSTANCE_STATS_SECRET, stored encrypted.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function loadReady(instanceId: string, step: StepId): Promise<Instance> {
  const instance = await getInstance(instanceId);
  if (!instance) throw new ProviderError("Console", 0, "istanza non trovata");
  const states = stepStates(await listSteps(instanceId));
  if (!canRun(step, states)) throw new ProviderError("Console", 0, "completa prima i passi precedenti");
  return instance;
}

async function updateInstance(id: string, values: Partial<typeof instances.$inferInsert>) {
  await getDb().update(instances).set(values).where(eq(instances.id, id));
}

async function mergeWizard(instance: Instance, patch: Partial<WizardState>): Promise<WizardState> {
  const wizard = { ...instance.wizard, ...patch };
  await updateInstance(instance.id, { wizard });
  return wizard;
}

/** Runs one step's effect; marks the step done or failed and audits it. */
async function runStep(instanceId: string, step: StepId, fn: () => Promise<string>): Promise<Result> {
  try {
    const detail = await fn();
    await setStep(instanceId, step, "done", detail);
    await audit(`step_${step}`, instanceId, detail);
    return { ok: true };
  } catch (e) {
    const error = userMessage(e);
    reportError(`step_${step}`, e);
    await setStep(instanceId, step, "failed", error).catch(() => {});
    await audit(`step_${step}_failed`, instanceId, error).catch(() => {});
    return { ok: false, error };
  }
}

/** For sub-actions that do not finish their step: failures are recorded, success is not. */
async function runPartial<T extends object>(instanceId: string, step: StepId, fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    const error = userMessage(e);
    reportError(`step_${step}`, e);
    await setStep(instanceId, step, "failed", error).catch(() => {});
    await audit(`step_${step}_failed`, instanceId, error).catch(() => {});
    return { ok: false, error };
  }
}

// --- 1. Anagrafica ------------------------------------------------------------

/** Creates the instance (status provisioning) or updates it while nothing was created yet. */
export async function saveRegistry(instanceId: string | null, input: RegistryInput): Promise<Result<{ instanceId: string }>> {
  const errors = registryErrors(input);
  if (errors.length) return { ok: false, error: errors.join(" ") };
  const clash = await getInstanceBySlug(input.slug);
  if (clash && clash.id !== instanceId) return { ok: false, error: "Esiste già un'istanza con questo slug." };

  const wizardPatch: Partial<WizardState> = {
    adminEmail: input.adminEmail.toLowerCase(),
    locale: input.locale,
    currency: input.currency,
    timeZone: input.timeZone,
  };
  const ids = {
    name: input.name.trim(),
    hostingModel: input.hostingModel,
    vercelTeamId: input.vercelTeamId,
    vercelTeamSlug: input.vercelTeamSlug,
    neonOrgId: input.neonOrgId,
  };

  if (!instanceId) {
    const id = newId("ins");
    await getDb().insert(instances).values({
      id,
      slug: input.slug,
      url: `https://${vercelProjectName(input.slug)}.vercel.app`,
      status: "provisioning",
      requestId: input.requestId,
      wizard: wizardPatch,
      ...ids,
    });
    if (input.requestId) {
      await getDb().update(requests).set({ status: "in_progress" }).where(eq(requests.id, input.requestId));
    }
    await setStep(id, "anagrafica", "done");
    await audit("instance_create", id, `slug ${input.slug}, modello ${input.hostingModel}`);
    return { ok: true, instanceId: id };
  }

  const instance = await getInstance(instanceId);
  if (!instance) return { ok: false, error: "Istanza non trovata." };
  const states = stepStates(await listSteps(instanceId));
  if (!canReopen("anagrafica", states)) {
    return { ok: false, error: "Il database o l'app esistono già: slug, team e organizzazione non si cambiano più da qui." };
  }
  await updateInstance(instanceId, {
    ...ids,
    slug: input.slug,
    url: `https://${vercelProjectName(input.slug)}.vercel.app`,
    wizard: { ...instance.wizard, ...wizardPatch },
  });
  await setStep(instanceId, "anagrafica", "done");
  await audit("instance_update", instanceId, `slug ${input.slug}`);
  return { ok: true, instanceId };
}

// --- 2. Identità iniziale -----------------------------------------------------

export interface IdentityInput {
  appName: string;
  shortName: string;
  primary: string | null;
  accent: string | null;
  logoUrl: string | null;
}

export async function saveIdentity(instanceId: string, input: IdentityInput): Promise<Result> {
  const instance = await getInstance(instanceId);
  if (!instance) return { ok: false, error: "Istanza non trovata." };
  const states = stepStates(await listSteps(instanceId));
  if (!canRun("identita", states)) return { ok: false, error: "Completa prima l'anagrafica." };
  if (!canReopen("identita", states)) return { ok: false, error: "L'app è già configurata: cambia l'identità dall'app stessa." };
  const brandInput = {
    ...input,
    locale: instance.wizard.locale ?? "it",
    currency: instance.wizard.currency ?? "EUR",
    supportEmail: instance.wizard.adminEmail ?? null,
  };
  const errors = brandErrors(brandInput);
  if (errors.length) return { ok: false, error: errors.join(" ") };
  return runStep(instanceId, "identita", async () => {
    await mergeWizard(instance, { ...input, brandJson: brandJsonString(brandInput) });
    return `nome ${input.appName.trim()}`;
  });
}

// --- 3. Database ----------------------------------------------------------------

export async function createDatabase(instanceId: string): Promise<Result> {
  return runStep(instanceId, "database", async () => {
    const instance = await loadReady(instanceId, "database");
    if (!databasePlan(instance).createProject) return `progetto Neon ${instance.neonProjectId} già presente`;
    const project = await neonFor().createProject({ name: vercelProjectName(instance.slug), orgId: instance.neonOrgId });
    await updateInstance(instanceId, { neonProjectId: project.id });
    return `progetto Neon ${project.id} creato`;
  });
}

// --- 4. App -----------------------------------------------------------------------

export async function createApp(instanceId: string): Promise<Result> {
  return runStep(instanceId, "app", async () => {
    let instance = await loadReady(instanceId, "app");
    const plan = appPlan(instance);
    if (plan.requiresDatabase) throw new ProviderError("Console", 0, "manca il progetto Neon");
    const vercel = vercelFor(instance);
    const name = vercelProjectName(instance.slug);

    if (plan.createProject) {
      let project = await vercel.getProject(name);
      if (!project) project = await vercel.createProject({ name, repo: env.repo() });
      await updateInstance(instanceId, { vercelProjectId: project.id, url: `https://${project.name}.vercel.app` });
      instance = (await getInstance(instanceId))!;
    }

    // One pass: the connection string lives only in this function's memory.
    const statsSecret = randomSecret();
    const vars = appEnvVars({
      databaseUrl: await neonFor().connectionUri(instance.neonProjectId!),
      authSecret: randomSecret(),
      bootstrapAdminEmail: instance.wizard.adminEmail ?? "",
      appBaseUrl: instance.url,
      brandJson: instance.wizard.brandJson ?? "{}",
      timeZone: instance.wizard.timeZone ?? "Europe/Rome",
      statsSecret,
    });
    await vercel.upsertEnv(instance.vercelProjectId!, vars);
    await updateInstance(instanceId, { statsSecretEnc: sealStatsSecret(instanceId, statsSecret) });
    return `progetto Vercel ${instance.vercelProjectId}; variabili: ${envKeys(vars)}`;
  });
}

// --- 5. Email -------------------------------------------------------------------

export async function chooseEmailMode(instanceId: string, mode: "group_domain" | "shared_domain", domain: string | null): Promise<Result> {
  const instance = await getInstance(instanceId);
  if (!instance) return { ok: false, error: "Istanza non trovata." };
  if (!canRun("email", stepStates(await listSteps(instanceId)))) return { ok: false, error: "Completa prima l'app." };
  if (mode === "group_domain") {
    const d = domain?.trim().toLowerCase() ?? "";
    if (!/^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return { ok: false, error: "Dominio non valido." };
    if (instance.resendDomainId && instance.wizard.emailDomain !== d) {
      return { ok: false, error: "Il dominio Resend è già stato creato: per cambiarlo rimuovilo prima da Resend." };
    }
    await mergeWizard(instance, { emailMode: mode, emailDomain: d });
  } else {
    if (!env.sharedMailDomain() || !env.sharedMailDomainId()) {
      return { ok: false, error: "CONSOLE_SHARED_MAIL_DOMAIN e CONSOLE_SHARED_MAIL_DOMAIN_ID non sono impostate." };
    }
    await mergeWizard(instance, { emailMode: mode });
  }
  await audit("email_mode", instanceId, mode);
  return { ok: true };
}

export async function createEmailDomain(instanceId: string): Promise<Result> {
  return runPartial(instanceId, "email", async () => {
    const instance = await loadReady(instanceId, "email");
    if (instance.resendDomainId) return {};
    if (!instance.wizard.emailDomain) throw new ProviderError("Console", 0, "scegli prima il dominio");
    const domain = await resendForProvisioning().createDomain(instance.wizard.emailDomain);
    await updateInstance(instanceId, { resendDomainId: domain.id });
    await audit("resend_domain_create", instanceId, domain.name);
    return {};
  });
}

export async function emailDomainStatus(instanceId: string): Promise<Result<{ status: string; records: DnsRecord[] }>> {
  const instance = await getInstance(instanceId);
  if (!instance?.resendDomainId) return { ok: false, error: "Nessun dominio Resend." };
  try {
    const d = await resendForProvisioning().getDomain(instance.resendDomainId);
    return { ok: true, status: d.status, records: d.records ?? [] };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

export async function verifyEmailDomain(instanceId: string): Promise<Result> {
  return runPartial(instanceId, "email", async () => {
    const instance = await loadReady(instanceId, "email");
    if (!instance.resendDomainId) throw new ProviderError("Console", 0, "nessun dominio Resend");
    await resendForProvisioning().verifyDomain(instance.resendDomainId);
    await audit("resend_domain_verify", instanceId, null);
    return {};
  });
}

export async function finishEmail(instanceId: string): Promise<Result> {
  return runStep(instanceId, "email", async () => {
    const instance = await loadReady(instanceId, "email");
    const resend = resendForProvisioning();
    const displayName = instance.wizard.appName ?? instance.name;
    let domainId: string;
    let from: string;
    if (instance.wizard.emailMode === "group_domain") {
      if (!instance.resendDomainId || !instance.wizard.emailDomain) throw new ProviderError("Console", 0, "crea prima il dominio");
      const d = await resend.getDomain(instance.resendDomainId);
      if (d.status !== "verified") throw new ProviderError("Resend", 0, `il dominio non è ancora verificato (${d.status})`);
      domainId = d.id;
      from = mailFrom(displayName, `noreply@${instance.wizard.emailDomain}`);
    } else if (instance.wizard.emailMode === "shared_domain") {
      domainId = env.sharedMailDomainId() ?? "";
      const shared = env.sharedMailDomain();
      if (!domainId || !shared) throw new ProviderError("Console", 0, "dominio condiviso non configurato");
      from = mailFrom(displayName, `${instance.slug}@${shared}`);
    } else {
      throw new ProviderError("Console", 0, "scegli prima come inviare le email");
    }
    const key = await resend.createSendingKey(vercelProjectName(instance.slug), domainId);
    const vars = emailEnvVars(key.token, from);
    await vercelFor(instance).upsertEnv(instance.vercelProjectId!, vars);
    await mergeWizard(instance, { mailFrom: from });
    return `chiave Resend solo invio (${key.id}); mittente ${from}; variabili: ${envKeys(vars)}`;
  });
}

// --- 6. Pagamenti -------------------------------------------------------------

export async function configureStripe(instanceId: string, secretKey: string): Promise<Result> {
  const info = classifyStripeKey(secretKey);
  if (!info) return { ok: false, error: "Serve una chiave segreta (sk_…) o limitata (rk_…) di Stripe." };
  return runStep(instanceId, "pagamenti", async () => {
    const instance = await loadReady(instanceId, "pagamenti");
    const endpoint = await stripeClient({ secretKey: secretKey.trim() }).replaceWebhookEndpoint(
      webhookUrl(instance.url),
      `WeGrocery ${instance.slug}`,
    );
    const vars = stripeEnvVars(secretKey.trim(), endpoint.secret);
    await vercelFor(instance).upsertEnv(instance.vercelProjectId!, vars);
    await mergeWizard(instance, { paymentsConfigured: true, stripeMode: info.mode });
    return `chiave ${info.kind === "secret" ? "segreta" : "limitata"} ${info.mode}; webhook ${endpoint.id}; variabili: ${envKeys(vars)}`;
  });
}

export async function skipStep(instanceId: string, step: "pagamenti" | "dominio"): Promise<Result> {
  const states = stepStates(await listSteps(instanceId));
  if (!canRun(step, states)) return { ok: false, error: "Completa prima i passi precedenti." };
  await setStep(instanceId, step, "skipped");
  await audit(`step_${step}_skipped`, instanceId, null);
  return { ok: true };
}

// --- 7. Pubblica / Ridistribuisci ----------------------------------------------

/** Starts a production build of main. Shared by the wizard, "Ridistribuisci" and the fleet rollout. */
export async function startDeployment(instance: Instance): Promise<string> {
  if (!instance.vercelProjectId) throw new ProviderError("Console", 0, "nessun progetto Vercel collegato");
  const deployment = await vercelFor(instance).createDeployment({
    projectName: vercelProjectName(instance.slug),
    projectId: instance.vercelProjectId,
    repoId: await wegroceryRepoId(),
  });
  await audit("deploy_start", instance.id, deployment.id);
  return deployment.id;
}

/**
 * One look at a deployment: build state, then health and signed stats once
 * it is READY (also stored as a snapshot). The first READY production build
 * may reveal the real `.vercel.app` address: the instance URL follows it.
 */
export async function checkDeployment(instance: Instance, deploymentId: string): Promise<{ phase: DeployPhase; message: string }> {
  const vercel = vercelFor(instance);
  const d = await vercel.getDeployment(deploymentId);
  if (d.readyState !== "READY") return evaluateDeploy({ readyState: d.readyState });

  const alias = productionAlias(d.alias);
  let note = "";
  if (alias && instance.url.endsWith(".vercel.app") && instance.url !== `https://${alias}`) {
    instance = { ...instance, url: `https://${alias}` };
    await updateInstance(instance.id, { url: instance.url });
    if (!instance.wizard.customDomain) {
      // The guessed address was taken: email links must follow the real one.
      await vercel.upsertEnv(instance.vercelProjectId!, baseUrlEnvVar(instance.url));
      note = ` Indirizzo reale ${instance.url}: APP_BASE_URL aggiornata, ridistribuisci perché valga.`;
    }
    await audit("instance_url", instance.id, instance.url);
  }
  const probe = await refreshInstance(instance);
  const r = evaluateDeploy({
    readyState: d.readyState,
    health: probe.health,
    stats: probe.stats,
    statsUnavailable: !instance.statsSecretEnc,
  });
  return { ...r, message: r.message + note };
}

export async function startPublish(instanceId: string): Promise<Result> {
  return runPartial(instanceId, "pubblica", async () => {
    const instance = await loadReady(instanceId, "pubblica");
    const deploymentId = await startDeployment(instance);
    await mergeWizard(instance, { deploymentId });
    await setStep(instanceId, "pubblica", "todo", `deploy ${deploymentId} avviato`);
    return {};
  });
}

export async function checkPublish(instanceId: string): Promise<Result<{ phase: DeployPhase; message: string }>> {
  try {
    const instance = await loadReady(instanceId, "pubblica");
    if (!instance.wizard.deploymentId) return { ok: false, error: "Nessun deploy avviato." };
    const r = await checkDeployment(instance, instance.wizard.deploymentId);
    if (r.phase === "ready") {
      await setStep(instanceId, "pubblica", "done", r.message);
      await audit("step_pubblica", instanceId, r.message);
    } else if (r.phase === "failed" || r.phase === "migrations_pending") {
      await setStep(instanceId, "pubblica", "failed", r.message);
      await audit("step_pubblica_failed", instanceId, r.message);
    }
    return { ok: true, ...r };
  } catch (e) {
    reportError("check_publish", e);
    return { ok: false, error: userMessage(e) };
  }
}

// --- 8. Dominio -------------------------------------------------------------------

export async function addCustomDomain(instanceId: string, domain: string): Promise<Result<{ domain: ProjectDomain }>> {
  const d = domain.trim().toLowerCase();
  if (!/^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return { ok: false, error: "Dominio non valido." };
  let added: ProjectDomain | null = null;
  const r = await runStep(instanceId, "dominio", async () => {
    const instance = await loadReady(instanceId, "dominio");
    const vercel = vercelFor(instance);
    added = await vercel.addDomain(instance.vercelProjectId!, d);
    const vars = baseUrlEnvVar(`https://${d}`);
    await vercel.upsertEnv(instance.vercelProjectId!, vars);
    await mergeWizard(instance, { customDomain: d });
    // The probes keep the vercel.app address until the domain answers; the
    // operator switches the URL on the instance page once DNS is in place.
    return `dominio ${d} aggiunto (${added.verified ? "verificato" : "da verificare"}); APP_BASE_URL aggiornata: serve un nuovo deploy`;
  });
  return r.ok && added ? { ok: true, domain: added } : r.ok ? { ok: false, error: "Dominio non aggiunto." } : r;
}

// --- 9. Consegna -------------------------------------------------------------------

export async function completeHandover(instanceId: string): Promise<Result> {
  return runStep(instanceId, "consegna", async () => {
    const instance = await loadReady(instanceId, "consegna");
    await updateInstance(instanceId, { status: "live" });
    if (instance.requestId) await getDb().update(requests).set({ status: "created" }).where(eq(requests.id, instance.requestId));
    return "istanza consegnata";
  });
}

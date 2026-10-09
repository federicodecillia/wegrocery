"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/session";
import { getDb, newId } from "@/lib/db/client";
import { audit, getInstance, getInstanceBySlug, listInstancesWithLatest } from "@/lib/db/queries";
import { instances } from "@/lib/db/schema";
import { isTerminal, type DeployPhase } from "@/lib/deploy-check";
import { refreshAll, refreshInstance } from "@/lib/fleet/refresh";
import { rolloutOrder } from "@/lib/fleet/rollout";
import { checkDeployment, startDeployment } from "@/lib/provisioning/runner";
import { reportError, userMessage } from "@/lib/report-error";
import { validateSlug } from "@/lib/slug";
import { MIN_STATS_SECRET_LENGTH } from "@/lib/stats/signature";
import { sealStatsSecret } from "@/lib/stats-secret";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(where: string, e: unknown): { ok: false; error: string } {
  reportError(where, e);
  return { ok: false, error: userMessage(e) };
}

const optional = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

function validUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export async function refreshAllAction(): Promise<ActionResult> {
  try {
    await assertOperator();
    const results = await refreshAll();
    await audit("refresh_all", null, `${results.length} istanze`);
    revalidatePath("/");
    const errors = results.filter((r) => r.result.error).length;
    return { ok: true, message: `Aggiornate ${results.length} istanze${errors ? `, ${errors} con problemi` : ""}.` };
  } catch (e) {
    return fail("refresh_all", e);
  }
}

export async function refreshOneAction(instanceId: string): Promise<ActionResult> {
  try {
    await assertOperator();
    const instance = await getInstance(instanceId);
    if (!instance) return { ok: false, error: "Istanza non trovata." };
    const r = await refreshInstance(instance);
    await audit("refresh", instanceId, null);
    revalidatePath(`/istanze/${instanceId}`);
    revalidatePath("/");
    return r.error ? { ok: true, message: `Aggiornata con avvisi: ${r.error}` } : { ok: true, message: "Aggiornata." };
  } catch (e) {
    return fail("refresh", e);
  }
}

export interface AddInstanceState {
  error: string | null;
}

/** "Aggiungi istanza esistente": the stats secret is pasted once and stored encrypted. */
export async function addExistingInstance(_prev: AddInstanceState, form: FormData): Promise<AddInstanceState> {
  let id: string;
  try {
    await assertOperator();
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const url = validUrl(String(form.get("url") ?? "").trim());
    const hostingModel = form.get("hostingModel") === "group_owned" ? "group_owned" : "managed";
    const secret = String(form.get("statsSecret") ?? "").trim();
    const rollout = Number(form.get("rolloutOrder") ?? 100);
    if (!name || name.length > 80) return { error: "Nome obbligatorio (max 80 caratteri)." };
    const slugError = validateSlug(slug);
    if (slugError) return { error: slugError };
    if (!url) return { error: "URL non valido: serve https://…" };
    if (secret && secret.length < MIN_STATS_SECRET_LENGTH) {
      return { error: `Il segreto delle statistiche deve avere almeno ${MIN_STATS_SECRET_LENGTH} caratteri.` };
    }
    if (!Number.isInteger(rollout) || rollout < 0 || rollout > 10_000) return { error: "Ordine di rilascio: un intero tra 0 e 10000." };
    if (await getInstanceBySlug(slug)) return { error: "Esiste già un'istanza con questo slug." };

    id = newId("ins");
    await getDb()
      .insert(instances)
      .values({
        id,
        slug,
        name,
        url,
        hostingModel,
        status: "live",
        rolloutOrder: rollout,
        vercelTeamId: optional(form.get("vercelTeamId")),
        vercelTeamSlug: optional(form.get("vercelTeamSlug")),
        vercelProjectId: optional(form.get("vercelProjectId")),
        neonOrgId: optional(form.get("neonOrgId")),
        neonProjectId: optional(form.get("neonProjectId")),
        statsSecretEnc: secret ? sealStatsSecret(id, secret) : null,
      });
    await audit("instance_add", id, `slug ${slug}, segreto statistiche ${secret ? "salvato" : "assente"}`);
    const created = await getInstance(id);
    if (created) await refreshInstance(created).catch((e) => reportError("refresh_after_add", e));
  } catch (e) {
    return { error: fail("instance_add", e).error };
  }
  revalidatePath("/");
  redirect(`/istanze/${id}`);
}

export interface MetaState {
  error: string | null;
  saved?: boolean;
}

/** Notes, URL, rollout order, dashboard ids and (optionally) a new stats secret. */
export async function updateInstanceMeta(instanceId: string, _prev: MetaState, form: FormData): Promise<MetaState> {
  try {
    await assertOperator();
    const instance = await getInstance(instanceId);
    if (!instance) return { error: "Istanza non trovata." };
    const url = validUrl(String(form.get("url") ?? "").trim());
    if (!url) return { error: "URL non valido: serve https://…" };
    const notes = String(form.get("notes") ?? "").slice(0, 5000);
    const rollout = Number(form.get("rolloutOrder") ?? instance.rolloutOrder);
    if (!Number.isInteger(rollout) || rollout < 0 || rollout > 10_000) return { error: "Ordine di rilascio: un intero tra 0 e 10000." };
    const secret = String(form.get("statsSecret") ?? "").trim();
    if (secret && secret.length < MIN_STATS_SECRET_LENGTH) {
      return { error: `Il segreto delle statistiche deve avere almeno ${MIN_STATS_SECRET_LENGTH} caratteri.` };
    }
    await getDb()
      .update(instances)
      .set({
        url,
        notes: notes || null,
        rolloutOrder: rollout,
        vercelTeamSlug: optional(form.get("vercelTeamSlug")),
        ...(secret ? { statsSecretEnc: sealStatsSecret(instanceId, secret) } : {}),
      })
      .where(eq(instances.id, instanceId));
    await audit("instance_meta", instanceId, `url ${url}, ordine ${rollout}${secret ? ", nuovo segreto statistiche" : ""}`);
    revalidatePath(`/istanze/${instanceId}`);
    return { error: null, saved: true };
  } catch (e) {
    return { error: fail("instance_meta", e).error };
  }
}

export async function setArchived(instanceId: string, archived: boolean): Promise<ActionResult> {
  try {
    await assertOperator();
    await getDb()
      .update(instances)
      .set({ status: archived ? "archived" : "live" })
      .where(eq(instances.id, instanceId));
    await audit(archived ? "instance_archive" : "instance_unarchive", instanceId, null);
    revalidatePath(`/istanze/${instanceId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail("archive", e);
  }
}

// --- Redeploy and fleet rollout ---------------------------------------------

export async function redeployAction(instanceId: string): Promise<{ ok: true; deploymentId: string } | { ok: false; error: string }> {
  try {
    await assertOperator();
    const instance = await getInstance(instanceId);
    if (!instance) return { ok: false, error: "Istanza non trovata." };
    return { ok: true, deploymentId: await startDeployment(instance) };
  } catch (e) {
    return fail("redeploy", e);
  }
}

export async function checkDeployAction(
  instanceId: string,
  deploymentId: string,
): Promise<{ ok: true; phase: DeployPhase; message: string; terminal: boolean } | { ok: false; error: string }> {
  try {
    await assertOperator();
    const instance = await getInstance(instanceId);
    if (!instance) return { ok: false, error: "Istanza non trovata." };
    const r = await checkDeployment(instance, deploymentId);
    const terminal = isTerminal(r.phase);
    if (terminal) {
      await audit(r.phase === "ready" ? "deploy_ok" : "deploy_failed", instanceId, r.message);
      revalidatePath("/");
    }
    return { ok: true, ...r, terminal };
  } catch (e) {
    return fail("check_deploy", e);
  }
}

/** The ordered list for "Aggiorna flotta". */
export async function rolloutPlanAction(): Promise<{ ok: true; items: { id: string; name: string }[] } | { ok: false; error: string }> {
  try {
    await assertOperator();
    const rows = await listInstancesWithLatest(false);
    const ordered = rolloutOrder(rows.map((r) => r.instance));
    await audit("fleet_rollout_plan", null, ordered.map((i) => i.slug).join(", "));
    return { ok: true, items: ordered.map((i) => ({ id: i.id, name: i.name })) };
  } catch (e) {
    return fail("rollout_plan", e);
  }
}

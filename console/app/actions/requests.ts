"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/session";
import { getDb, newId } from "@/lib/db/client";
import { audit, countRecentRequests } from "@/lib/db/queries";
import { requests, type RequestStatus } from "@/lib/db/schema";
import { sessionSecret } from "@/lib/env";
import { validateIntake } from "@/lib/intake";
import { mailOperator } from "@/lib/mail";
import { INTAKE_MAX_PER_HOUR, clientIp, hashIp, underLimit } from "@/lib/request-ip";
import { reportError, userMessage } from "@/lib/report-error";

export interface IntakeState {
  errors: Record<string, string>;
  formError: string | null;
  values: Record<string, string>;
}

/** Public: the intake form at /richiesta. No session; honeypot, rate limit, validation. */
export async function submitIntake(_prev: IntakeState, form: FormData): Promise<IntakeState> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") values[k] = v.slice(0, 5000);
  const result = validateIntake(values);
  // A bot that filled the honeypot gets the thank-you page and nothing is stored.
  if (!result.ok && result.spam) redirect("/richiesta/grazie");
  if (!result.ok) return { errors: result.errors, formError: "Controlla i campi segnati.", values };

  try {
    const ipHash = hashIp(clientIp(await headers()), sessionSecret());
    const since = new Date(Date.now() - 60 * 60 * 1000);
    if (!underLimit(await countRecentRequests(ipHash, since), INTAKE_MAX_PER_HOUR)) {
      return { errors: {}, formError: "Troppe richieste da questa rete: riprova tra un'ora.", values };
    }
    const d = result.data;
    const id = newId("req");
    await getDb().insert(requests).values({ id, ...d, privacyAcceptedAt: new Date(), ipHash });
    await audit("request_new", null, id);
    await mailOperator(
      `Nuova richiesta WeGrocery: ${d.groupName}`,
      [
        `${d.groupName}${d.city ? ` (${d.city})` : ""}`,
        `Referente: ${d.contactName} <${d.contactEmail}>`,
        `Soci indicativi: ${d.membersEstimate ?? "—"}`,
        `Modello preferito: ${d.hostingPreference === "managed" ? "gestito" : "account del gruppo"}`,
        "",
        "Apri la console, sezione Richieste, per i dettagli.",
      ].join("\n"),
    );
  } catch (e) {
    reportError("intake", e);
    return { errors: {}, formError: "Non siamo riusciti a salvare la richiesta: riprova più tardi.", values };
  }
  redirect("/richiesta/grazie");
}

const STATUSES: RequestStatus[] = ["new", "in_progress", "created", "discarded"];

export async function setRequestStatus(id: string, status: RequestStatus): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertOperator();
    if (!STATUSES.includes(status)) return { ok: false, error: "Stato non valido." };
    await getDb().update(requests).set({ status }).where(eq(requests.id, id));
    await audit("request_status", null, `${id} → ${status}`);
    revalidatePath("/richieste");
    return { ok: true };
  } catch (e) {
    reportError("request_status", e);
    return { ok: false, error: userMessage(e) };
  }
}

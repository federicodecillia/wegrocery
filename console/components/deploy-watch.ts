"use client";

import { checkDeployAction, redeployAction } from "@/app/actions/instances";

// Client-side driver for one redeploy: start it, then ask the server every
// few seconds until the build is ready and the instance healthy (or not).
// Each server action is short, so no request outlives a function timeout.

export const POLL_MS = 8000;
export const MAX_WAIT_MS = 20 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function redeployAndWait(
  instanceId: string,
  onProgress: (message: string) => void,
  isCancelled: () => boolean = () => false,
): Promise<{ ok: boolean; message: string }> {
  const started = await redeployAction(instanceId);
  if (!started.ok) return { ok: false, message: started.error };
  onProgress("Deploy avviato…");
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (isCancelled()) return { ok: false, message: "Interrotto." };
    await sleep(POLL_MS);
    const r = await checkDeployAction(instanceId, started.deploymentId);
    if (!r.ok) return { ok: false, message: r.error };
    onProgress(r.message);
    if (r.terminal) return { ok: r.phase === "ready", message: r.message };
  }
  return { ok: false, message: "Tempo scaduto: controlla il deploy su Vercel." };
}

import { insertSnapshot, listInstancesWithLatest } from "@/lib/db/queries";
import type { Instance } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { githubClient } from "@/lib/providers/github";
import { probeInstance, type ProbeResult } from "@/lib/stats/probe";
import { openStatsSecret } from "@/lib/stats-secret";

// Refresh = probe each instance (health + signed stats) and store a snapshot.

export async function refreshInstance(instance: Instance): Promise<ProbeResult> {
  const result = await probeInstance(instance.url, openStatsSecret(instance.id, instance.statsSecretEnc));
  await insertSnapshot({
    instanceId: instance.id,
    healthOk: result.health?.ok ?? null,
    healthVersion: result.health?.version ?? result.stats?.version ?? null,
    healthDb: result.health?.db ?? null,
    stats: result.stats,
    error: result.error,
  });
  return result;
}

/** Every non-archived instance, three at a time. */
export async function refreshAll(): Promise<{ instance: Instance; result: ProbeResult }[]> {
  const rows = await listInstancesWithLatest(false);
  const out: { instance: Instance; result: ProbeResult }[] = [];
  const queue = rows.map((r) => r.instance);
  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      out.push({ instance: next, result: await refreshInstance(next) });
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

// The latest GitHub release, kept for an hour per server instance.
let releaseCache: { value: string | null; at: number } | null = null;

export async function latestRelease(): Promise<string | null> {
  if (releaseCache && Date.now() - releaseCache.at < 60 * 60 * 1000) return releaseCache.value;
  try {
    const value = await githubClient({ token: env.githubToken() }).latestRelease(env.repo());
    releaseCache = { value, at: Date.now() };
  } catch {
    // Unreachable or rate-limited: the fleet's newest version still works.
    releaseCache = { value: releaseCache?.value ?? null, at: Date.now() - 50 * 60 * 1000 };
  }
  return releaseCache.value;
}

let repoIdCache: string | null = null;

/** Numeric id of the WeGrocery repository, for Vercel's gitSource. */
export async function wegroceryRepoId(): Promise<string> {
  const fromEnv = env.repoId();
  if (fromEnv) return fromEnv;
  if (!repoIdCache) repoIdCache = String(await githubClient({ token: env.githubToken() }).repoId(env.repo()));
  return repoIdCache;
}

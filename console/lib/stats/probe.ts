import { fetchWithTimeout, readJson, type FetchLike } from "@/lib/http";
import { signedStatsHeaders, STATS_PATH } from "./signature";
import { parseHealth, parseStats, type HealthResponse, type InstanceStats } from "./types";

// One look at an instance: its public health, then its signed stats.
// Never throws: what went wrong is the snapshot's `error`.

export interface ProbeResult {
  health: HealthResponse | null;
  stats: InstanceStats | null;
  error: string | null;
}

export function baseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function probeInstance(
  url: string,
  statsSecret: string | null,
  fetchImpl: FetchLike = fetch,
  nowSeconds: number = Date.now() / 1000,
): Promise<ProbeResult> {
  const errors: string[] = [];
  let health: HealthResponse | null = null;
  let stats: InstanceStats | null = null;

  try {
    // 503 still carries { ok: false, db: false }: parse the body either way.
    const res = await fetchWithTimeout(fetchImpl, `${baseUrl(url)}/api/health`);
    health = parseHealth(await readJson(res));
    if (!health) errors.push(`health: risposta non valida (HTTP ${res.status})`);
  } catch (e) {
    errors.push(`health: ${e instanceof Error && e.name === "AbortError" ? "timeout" : "non raggiungibile"}`);
  }

  if (!statsSecret) {
    errors.push("stats: segreto non configurato");
  } else {
    try {
      const res = await fetchWithTimeout(fetchImpl, `${baseUrl(url)}${STATS_PATH}`, {
        headers: { Accept: "application/json", ...signedStatsHeaders(statsSecret, nowSeconds) },
      });
      if (res.status === 404) errors.push("stats: endpoint chiuso (INSTANCE_STATS_SECRET non impostato?)");
      else if (res.status === 401 || res.status === 403) errors.push(`stats: firma rifiutata (HTTP ${res.status})`);
      else if (!res.ok) errors.push(`stats: HTTP ${res.status}`);
      else {
        stats = parseStats(await readJson(res));
        if (!stats) errors.push("stats: risposta non valida");
      }
    } catch (e) {
      errors.push(`stats: ${e instanceof Error && e.name === "AbortError" ? "timeout" : "non raggiungibile"}`);
    }
  }

  return { health, stats, error: errors.length ? errors.join("; ") : null };
}

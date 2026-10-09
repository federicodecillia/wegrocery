import type { ReadyState } from "@/lib/providers/vercel";
import type { HealthResponse, InstanceStats } from "@/lib/stats/types";

// After a deployment: is the instance up on the new build? Used by the
// wizard's "Pubblica" step, by "Ridistribuisci" and by the fleet rollout.
// Pure: the caller fetches, this decides.

export type DeployPhase = "building" | "failed" | "waiting_health" | "migrations_pending" | "ready";

export interface DeployObservation {
  readyState: ReadyState | undefined;
  health?: HealthResponse | null;
  stats?: InstanceStats | null;
  /** Stats could not be read (no secret, endpoint closed): health alone decides. */
  statsUnavailable?: boolean;
}

export function evaluateDeploy(o: DeployObservation): { phase: DeployPhase; message: string } {
  switch (o.readyState) {
    case "ERROR":
      return { phase: "failed", message: "La build è fallita: guarda il log su Vercel." };
    case "CANCELED":
    case "DELETED":
      return { phase: "failed", message: "Il deploy è stato annullato." };
    case "READY":
      break;
    default:
      return { phase: "building", message: `Build in corso (${o.readyState ?? "in coda"})…` };
  }
  if (!o.health?.ok) return { phase: "waiting_health", message: "Build pronta, in attesa che /api/health risponda ok…" };
  if (o.stats && o.stats.pendingMigrations.length) {
    return { phase: "migrations_pending", message: `Migrazioni in sospeso: ${o.stats.pendingMigrations.join(", ")}` };
  }
  if (!o.stats && !o.statsUnavailable) return { phase: "waiting_health", message: "In attesa delle statistiche firmate…" };
  return { phase: "ready", message: `Online${o.health.version ? ` (versione ${o.health.version})` : ""}.` };
}

export function isTerminal(phase: DeployPhase): boolean {
  return phase === "ready" || phase === "failed" || phase === "migrations_pending";
}

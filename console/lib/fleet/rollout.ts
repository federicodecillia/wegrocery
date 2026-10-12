// "Aggiorna flotta": redeploy the instances one at a time, each waiting for
// its /api/health before the next, stopping at the first failure. Instances
// with a higher `rollout_order` go later: give the production installations
// with real members (Porta Moneta) a high number so the demo and the smaller
// groups take a new version first. Pure: the client drives it step by step
// through server actions, so no single request outlives a function timeout.

export interface RolloutCandidate {
  id: string;
  name: string;
  status: "provisioning" | "live" | "archived";
  rolloutOrder: number;
  createdAt: Date | string;
  vercelProjectId: string | null;
}

export function rolloutOrder<T extends RolloutCandidate>(instances: T[]): T[] {
  return instances
    .filter((i) => i.status === "live" && i.vercelProjectId)
    .sort(
      (a, b) =>
        a.rolloutOrder - b.rolloutOrder ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.name.localeCompare(b.name),
    );
}

export type RolloutItemStatus = "pending" | "deploying" | "done" | "failed";

export interface RolloutItem {
  instanceId: string;
  name: string;
  status: RolloutItemStatus;
  deploymentId?: string;
  message?: string;
}

export type RolloutAction =
  | { kind: "deploy"; instanceId: string }
  | { kind: "check"; instanceId: string; deploymentId: string }
  | { kind: "stopped"; instanceId: string }
  | { kind: "finished" };

export function nextRolloutAction(items: RolloutItem[]): RolloutAction {
  const failed = items.find((i) => i.status === "failed");
  if (failed) return { kind: "stopped", instanceId: failed.instanceId };
  const current = items.find((i) => i.status !== "done");
  if (!current) return { kind: "finished" };
  if (current.status === "deploying" && current.deploymentId) {
    return { kind: "check", instanceId: current.instanceId, deploymentId: current.deploymentId };
  }
  return { kind: "deploy", instanceId: current.instanceId };
}

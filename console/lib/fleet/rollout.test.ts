import { describe, expect, it } from "vitest";
import { nextRolloutAction, rolloutOrder, type RolloutCandidate, type RolloutItem } from "./rollout";

const inst = (id: string, rolloutOrder: number, createdAt: string, extra: Partial<RolloutCandidate> = {}): RolloutCandidate => ({
  id,
  name: id,
  status: "live",
  rolloutOrder,
  createdAt,
  vercelProjectId: `prj_${id}`,
  ...extra,
});

describe("rolloutOrder", () => {
  it("puts high rollout_order (production with real members) last", () => {
    const list = [
      inst("portamoneta", 1000, "2025-01-01"),
      inst("demo", 10, "2025-06-01"),
      inst("riva", 100, "2026-01-01"),
      inst("bosco", 100, "2025-12-01"),
    ];
    expect(rolloutOrder(list).map((i) => i.id)).toEqual(["demo", "bosco", "riva", "portamoneta"]);
  });

  it("leaves out archived, provisioning and unlinked instances", () => {
    const list = [
      inst("a", 1, "2025-01-01", { status: "archived" }),
      inst("b", 1, "2025-01-01", { status: "provisioning" }),
      inst("c", 1, "2025-01-01", { vercelProjectId: null }),
      inst("d", 1, "2025-01-01"),
    ];
    expect(rolloutOrder(list).map((i) => i.id)).toEqual(["d"]);
  });
});

describe("nextRolloutAction", () => {
  const items = (...s: RolloutItem["status"][]): RolloutItem[] =>
    s.map((status, i) => ({ instanceId: `i${i}`, name: `i${i}`, status, deploymentId: status === "deploying" ? `d${i}` : undefined }));

  it("deploys the first pending one", () => {
    expect(nextRolloutAction(items("pending", "pending"))).toEqual({ kind: "deploy", instanceId: "i0" });
  });
  it("checks the one deploying before moving on", () => {
    expect(nextRolloutAction(items("done", "deploying", "pending"))).toEqual({ kind: "check", instanceId: "i1", deploymentId: "d1" });
  });
  it("moves on once the previous is done", () => {
    expect(nextRolloutAction(items("done", "pending"))).toEqual({ kind: "deploy", instanceId: "i1" });
  });
  it("stops at the first failure", () => {
    expect(nextRolloutAction(items("done", "failed", "pending"))).toEqual({ kind: "stopped", instanceId: "i1" });
  });
  it("finishes", () => {
    expect(nextRolloutAction(items("done", "done"))).toEqual({ kind: "finished" });
    expect(nextRolloutAction([])).toEqual({ kind: "finished" });
  });
});

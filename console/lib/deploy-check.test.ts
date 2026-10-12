import { describe, expect, it } from "vitest";
import { evaluateDeploy, isTerminal } from "./deploy-check";
import type { InstanceStats } from "@/lib/stats/types";

const stats = (pending: string[] = []) => ({ pendingMigrations: pending }) as unknown as InstanceStats;
const ok = { ok: true, version: "1.26.0", db: true };

describe("evaluateDeploy", () => {
  it("waits while building", () => {
    expect(evaluateDeploy({ readyState: "BUILDING" }).phase).toBe("building");
    expect(evaluateDeploy({ readyState: undefined }).phase).toBe("building");
  });
  it("fails on error or cancel", () => {
    expect(evaluateDeploy({ readyState: "ERROR" }).phase).toBe("failed");
    expect(evaluateDeploy({ readyState: "CANCELED" }).phase).toBe("failed");
  });
  it("waits for health after the build", () => {
    expect(evaluateDeploy({ readyState: "READY", health: { ok: false, version: null, db: false } }).phase).toBe("waiting_health");
  });
  it("reports pending migrations", () => {
    const r = evaluateDeploy({ readyState: "READY", health: ok, stats: stats(["0034_x.sql"]) });
    expect(r.phase).toBe("migrations_pending");
    expect(r.message).toContain("0034_x.sql");
  });
  it("is ready with healthy app and no pending migrations", () => {
    expect(evaluateDeploy({ readyState: "READY", health: ok, stats: stats() }).phase).toBe("ready");
    expect(evaluateDeploy({ readyState: "READY", health: ok, statsUnavailable: true }).phase).toBe("ready");
  });
  it("knows the terminal phases", () => {
    expect(isTerminal("ready")).toBe(true);
    expect(isTerminal("building")).toBe(false);
  });
});

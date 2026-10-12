import { describe, expect, it } from "vitest";
import { alertEmailText, instanceAlerts } from "./alerts";
import type { InstanceStats } from "@/lib/stats/types";

const stats = (over: Partial<InstanceStats> = {}) =>
  ({ pendingMigrations: [], config: [{ id: "email", status: "ok" }], ...over }) as InstanceStats;

describe("instanceAlerts", () => {
  it("is quiet for a healthy instance", () => {
    expect(instanceAlerts({ name: "a", url: "u", health: { ok: true, version: "1", db: true }, stats: stats(), error: null })).toEqual([]);
  });
  it("flags down, pending migrations and missing config", () => {
    const a = instanceAlerts({
      name: "a",
      url: "u",
      health: { ok: false, version: "1", db: false },
      stats: stats({ pendingMigrations: ["0034.sql"], config: [{ id: "resend", status: "missing" }, { id: "x", status: "warning" }] }),
      error: null,
    });
    expect(a).toHaveLength(3);
    expect(a[2]).toContain("resend");
  });
  it("flags an unreachable instance", () => {
    expect(instanceAlerts({ name: "a", url: "u", health: null, stats: null, error: "timeout" })[0]).toContain("non risponde");
  });
  it("writes the email", () => {
    const t = alertEmailText([{ name: "Riva", url: "https://r", alerts: ["x"] }], "https://console");
    expect(t).toContain("Riva (https://r)");
    expect(t).toContain("  - x");
    expect(t).toContain("Console: https://console");
  });
});

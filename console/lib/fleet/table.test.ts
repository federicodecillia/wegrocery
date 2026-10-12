import { describe, expect, it } from "vitest";
import { fleetCsv, fleetNewest, fleetRows, fleetTotals, matchesSearch, type FleetSource } from "./table";
import type { InstanceStats } from "@/lib/stats/types";

const stats = (version: string, active: number, orders: number): InstanceStats => ({
  version,
  generatedAt: "2026-10-09T00:00:00Z",
  installedAt: null,
  members: { active, admins: 2, total: active + 3 },
  cycles: { total: 10, open: 1, lastClosedAt: null },
  ordersLast30Days: orders,
  databaseBytes: 1000,
  paymentMode: "wallet",
  config: [{ id: "email", status: "missing" }],
  pendingMigrations: [],
  setupCompleted: true,
});

const src = (name: string, s: InstanceStats | null, healthOk: boolean | null = true): FleetSource => ({
  instance: { id: name, name, slug: name, url: `https://${name}.example`, hostingModel: "managed", status: "live", createdAt: new Date("2026-01-02T00:00:00Z") },
  latest: s || healthOk !== null ? { takenAt: new Date("2026-10-09T05:00:00Z"), healthOk, healthVersion: s?.version ?? null, stats: s, error: null } : null,
});

describe("fleet table", () => {
  const sources = [src("riva", stats("1.25.0", 40, 10)), src("bosco, ovest", stats("1.26.0", 12, 5)), src("nuovo", null, null)];

  it("finds the newest version, GitHub included", () => {
    expect(fleetNewest(sources, null)).toBe("1.26.0");
    expect(fleetNewest(sources, "v1.27.0")).toBe("1.27.0");
  });

  it("builds rows with flags and counts", () => {
    const rows = fleetRows(sources, "1.26.0");
    expect(rows[0]).toMatchObject({ behind: true, health: "ok", activeMembers: 40, configMissing: 1 });
    expect(rows[1].behind).toBe(false);
    expect(rows[2]).toMatchObject({ health: "unknown", activeMembers: null, version: null, behind: false });
  });

  it("totals the fleet", () => {
    expect(fleetTotals(fleetRows(sources, null))).toEqual({ instances: 3, activeMembers: 52, orders30: 15 });
  });

  it("searches name, slug and URL", () => {
    const rows = fleetRows(sources, null);
    expect(rows.filter((r) => matchesSearch(r, "RIVA")).map((r) => r.id)).toEqual(["riva"]);
    expect(rows.filter((r) => matchesSearch(r, "")).length).toBe(3);
  });

  it("exports an escaped CSV with the same columns", () => {
    const csv = fleetCsv(fleetRows(sources, "1.26.0"));
    const lines = csv.trim().split("\r\n");
    expect(lines[0].split(",")).toHaveLength(15);
    expect(lines[1].startsWith("riva,https://riva.example,Gestito,2026-01-02,1.25.0,si,OK,40,2,10,10,1000,1,0,")).toBe(true);
    expect(lines[2].startsWith('"bosco, ovest",')).toBe(true);
  });
});

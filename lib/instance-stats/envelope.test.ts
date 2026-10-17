import { describe, expect, it } from "vitest";
import type { WeGroceryInstanceStats } from "./collect";
import { toFlyLabsStats } from "./envelope";

const legacy: WeGroceryInstanceStats = {
  version: "1.31.0",
  generatedAt: "2026-10-17T10:00:00.000Z",
  installedAt: "2026-07-11T08:00:00.000Z",
  members: { active: 40, admins: 3, total: 52 },
  cycles: { total: 30, open: 1, lastClosedAt: "2026-10-12T21:59:00.000Z" },
  ordersLast30Days: 61,
  databaseBytes: 12_345_678,
  paymentMode: "wallet",
  config: [{ id: "database", status: "ok" }],
  pendingMigrations: [],
  setupCompleted: true,
};

describe("toFlyLabsStats", () => {
  it("answers the kit's envelope with WeGrocery's counts by name", () => {
    expect(toFlyLabsStats(legacy)).toEqual({
      app: "wegrocery",
      version: "1.31.0",
      generatedAt: "2026-10-17T10:00:00.000Z",
      installedAt: "2026-07-11T08:00:00.000Z",
      databaseBytes: 12_345_678,
      counts: { activeMembers: 40, admins: 3, members: 52, cycles: 30, openCycles: 1, ordersLast30Days: 61 },
      config: [{ id: "database", status: "ok" }],
      pendingMigrations: [],
      lastClosedAt: "2026-10-12T21:59:00.000Z",
      paymentMode: "wallet",
      setupCompleted: true,
    });
  });

  it("keeps every count a finite number", () => {
    expect(Object.values(toFlyLabsStats(legacy).counts).every(Number.isFinite)).toBe(true);
  });
});

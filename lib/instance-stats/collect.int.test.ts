import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { collectInstanceStats } from "./collect";

// The anonymous counts on a real database: they count the rows, and nothing
// that names a member leaves the endpoint.
describeDb("instance stats", () => {
  const scope = makeScope("stats");

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("counts members and cycles without naming anyone", async () => {
    const stats = await collectInstanceStats(new Date());
    expect(stats.members.active).toBeGreaterThanOrEqual(1);
    expect(stats.members.total).toBeGreaterThanOrEqual(stats.members.active);
    expect(stats.cycles.total).toBeGreaterThanOrEqual(stats.cycles.open);
    expect(stats.ordersLast30Days).toBeGreaterThanOrEqual(0);
    expect(stats.pendingMigrations).toEqual([]);
    expect(stats.config.map((c) => c.id)).toContain("database");

    const json = JSON.stringify(stats);
    expect(json).not.toContain(scope.prefix);
    expect(json).not.toContain(scope.memberName);
    expect(json).not.toContain("@");
  });
});

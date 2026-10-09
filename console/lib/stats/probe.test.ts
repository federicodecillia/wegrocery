import { describe, expect, it } from "vitest";
import { mockFetch } from "@/test/mock-fetch";
import { probeInstance } from "./probe";
import { statsSignature } from "./signature";
import { configCounts, parseStats } from "./types";

const SECRET = "x".repeat(40);
const STATS = {
  version: "1.26.0",
  generatedAt: "2026-10-09T10:00:00.000Z",
  installedAt: "2026-01-01T00:00:00.000Z",
  members: { active: 40, admins: 3, total: 52 },
  cycles: { total: 30, open: 1, lastClosedAt: "2026-10-01T18:00:00.000Z" },
  ordersLast30Days: 75,
  databaseBytes: 12_345_678,
  paymentMode: "wallet",
  config: [
    { id: "email", status: "ok" },
    { id: "stripe", status: "missing" },
    { id: "brand", status: "warning" },
  ],
  pendingMigrations: [],
  setupCompleted: true,
};

describe("probeInstance", () => {
  it("reads health, then the signed stats", async () => {
    const f = mockFetch([{ body: { ok: true, version: "1.26.0", db: true } }, { body: STATS }]);
    const r = await probeInstance("https://gas.example.org/", SECRET, f, 1_700_000_000);
    expect(r.error).toBeNull();
    expect(r.health).toEqual({ ok: true, version: "1.26.0", db: true });
    expect(r.stats?.members.active).toBe(40);
    expect(f.calls[0].url).toBe("https://gas.example.org/api/health");
    expect(f.calls[1].url).toBe("https://gas.example.org/api/instance-stats");
    expect(f.calls[1].headers["x-wegrocery-timestamp"]).toBe("1700000000");
    expect(f.calls[1].headers["x-wegrocery-signature"]).toBe(statsSignature(SECRET, 1_700_000_000));
  });

  it("keeps the 503 health body and reports a closed stats endpoint", async () => {
    const f = mockFetch([{ status: 503, body: { ok: false, version: "1.26.0", db: false } }, { status: 404 }]);
    const r = await probeInstance("https://gas.example.org", SECRET, f);
    expect(r.health).toEqual({ ok: false, version: "1.26.0", db: false });
    expect(r.stats).toBeNull();
    expect(r.error).toContain("endpoint chiuso");
  });

  it("skips the stats without a secret", async () => {
    const f = mockFetch([{ body: { ok: true, version: "1.0.0", db: true } }]);
    const r = await probeInstance("https://a.example", null, f);
    expect(f.calls).toHaveLength(1);
    expect(r.error).toContain("segreto");
  });
});

describe("parseStats", () => {
  it("accepts the contract", () => {
    expect(parseStats(STATS)).toEqual(STATS);
  });
  it("rejects a wrong shape", () => {
    expect(parseStats({ ...STATS, members: { active: "4" } })).toBeNull();
    expect(parseStats({ ...STATS, config: [{ id: "x", status: "bad" }] })).toBeNull();
    expect(parseStats(null)).toBeNull();
  });
  it("counts missing and warning items", () => {
    expect(configCounts(parseStats(STATS))).toEqual({ missing: 1, warning: 1 });
    expect(configCounts(null)).toEqual({ missing: 0, warning: 0 });
  });
});

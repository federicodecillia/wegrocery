import { describe, expect, it } from "vitest";
import { groupByDay } from "./day-groups";

describe("groupByDay", () => {
  // Europe/Rome in summer is UTC+2: 23:30 UTC is already the next day there.
  const now = new Date("2026-10-08T10:00:00Z");
  const at = (iso: string, id: string) => ({ id, createdAt: new Date(iso) });

  it("labels today and yesterday and keeps the order", () => {
    const groups = groupByDay(
      [at("2026-10-08T09:00:00Z", "a"), at("2026-10-08T06:00:00Z", "b"), at("2026-10-07T12:00:00Z", "c"), at("2026-10-05T12:00:00Z", "d")],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      [groups[2].label, ["d"]],
    ]);
    expect(groups[2].label).toMatch(/Mon/);
  });

  it("splits days in the app's time zone, not UTC", () => {
    const groups = groupByDay([at("2026-10-07T23:30:00Z", "late")], now);
    expect(groups[0].label).toBe("Today");
  });
});

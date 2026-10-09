import { describe, expect, it } from "vitest";
import { cycleViews, defaultCycleId, filterCycles, groupCycles, resolveCycleView, settlementCandidate, settlementPending } from "./cycle-views";

const d = (iso: string) => new Date(iso);

describe("cycle views", () => {
  it("offers products only while open, supplier and accounts after the close", () => {
    expect(cycleViews("open")).toEqual(["panoramica", "prodotti", "ordini"]);
    expect(cycleViews("closed")).toEqual(["panoramica", "ordini", "fornitore", "conti"]);
    expect(cycleViews("cancelled")).toEqual(["panoramica", "ordini", "conti"]);
  });

  it("falls back to the overview for a view the cycle does not have", () => {
    expect(resolveCycleView("open", "conti")).toBe("panoramica");
    expect(resolveCycleView("closed", "ordini")).toBe("ordini");
    expect(resolveCycleView("closed", "nonsense")).toBe("panoramica");
    expect(resolveCycleView("closed", undefined)).toBe("panoramica");
  });
});

describe("defaultCycleId", () => {
  const cycles = [
    { cycleId: "old", status: "closed", orderCloseAt: d("2026-01-01"), createdAt: d("2025-12-20") },
    { cycleId: "new", status: "closed", orderCloseAt: d("2026-09-01"), createdAt: d("2026-08-20") },
    { cycleId: "openLate", status: "open", orderCloseAt: d("2026-10-30"), createdAt: d("2026-10-01") },
    { cycleId: "openSoon", status: "open", orderCloseAt: d("2026-10-10"), createdAt: d("2026-10-02") },
  ];

  it("keeps the cycle asked for when it exists", () => {
    expect(defaultCycleId(cycles, "old")).toBe("old");
    expect(defaultCycleId(cycles, "gone")).toBe("openSoon");
  });

  it("prefers the open cycle closing first, then the newest", () => {
    expect(defaultCycleId(cycles)).toBe("openSoon");
    expect(defaultCycleId(cycles.filter((c) => c.status !== "open"))).toBe("new");
    expect(defaultCycleId([])).toBeNull();
  });
});

describe("filterCycles", () => {
  const list = [
    { title: "Ciclo di Ottobre", status: "open" },
    { title: "Settembre verdure", status: "closed" },
    { title: "Prova annullata", status: "cancelled" },
  ];
  it("filters by status and title words", () => {
    expect(filterCycles(list, "closed", "")).toHaveLength(1);
    expect(filterCycles(list, "all", "OTTO")).toEqual([list[0]]);
    expect(filterCycles(list, "all", "prova settembre")).toEqual([]);
  });
});

describe("settlementCandidate and settlementPending", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const base = { status: "closed", paymentMode: "per_order", settledAt: null as Date | null };
  it("checks closed or cancelled card cycles, not settled or settled in the last 90 days", () => {
    expect(settlementCandidate(base, now)).toBe(true);
    expect(settlementCandidate({ ...base, status: "cancelled" }, now)).toBe(true);
    expect(settlementCandidate({ ...base, status: "open" }, now)).toBe(false);
    expect(settlementCandidate({ ...base, paymentMode: "wallet" }, now)).toBe(false);
    expect(settlementCandidate({ ...base, settledAt: new Date("2026-08-01T00:00:00Z") }, now)).toBe(true);
    expect(settlementCandidate({ ...base, settledAt: new Date("2026-06-01T00:00:00Z") }, now)).toBe(false);
  });
  it("asks to act when never settled, reopened by a correction or a refund failed", () => {
    expect(settlementPending("to_settle")).toBe(true);
    expect(settlementPending("needs_update")).toBe(true);
    expect(settlementPending("refund_failed")).toBe(true);
    expect(settlementPending("refunds_pending")).toBe(false);
    expect(settlementPending("settled")).toBe(false);
    expect(settlementPending(null)).toBe(false);
  });
});

describe("groupCycles", () => {
  it("puts the accounts to settle first, then the open cycles, then the rest, keeping the order", () => {
    const list = [
      { id: "a", status: "closed", toSettle: false },
      { id: "b", status: "open", toSettle: false },
      { id: "c", status: "closed", toSettle: true },
      { id: "d", status: "cancelled", toSettle: false },
      { id: "e", status: "closed", toSettle: true },
    ];
    expect(groupCycles(list).map((g) => [g.group, g.cycles.map((c) => c.id)])).toEqual([
      ["toSettle", ["c", "e"]],
      ["open", ["b"]],
      ["others", ["a", "d"]],
    ]);
    expect(groupCycles(list.filter((c) => !c.toSettle)).map((g) => g.group)).toEqual(["open", "others"]);
  });
});

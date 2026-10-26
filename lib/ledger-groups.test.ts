import { describe, expect, it } from "vitest";
import { groupLedgerByCycle } from "./ledger-groups";

const e = (entryId: string, amount: string, cycleId: string | null) => ({ entryId, amount, cycleId });

describe("groupLedgerByCycle (Admin → Cassa)", () => {
  it("folds a cycle's movements into one group with their net total", () => {
    const items = groupLedgerByCycle([
      e("a", "-22.50", "c2"),
      e("b", "0.60", "c1"),
      e("c", "-0.30", "c1"),
      e("d", "-0.05", "c1"),
      e("f", "-1.00", "c1"),
      e("g", "-8.55", "c1"),
      e("h", "40.00", null),
    ]);
    expect(items.map((i) => (i.kind === "entry" ? i.entry.entryId : i.cycleId))).toEqual(["a", "c1", "h"]);
    const group = items[1];
    expect(group.kind).toBe("cycle");
    if (group.kind !== "cycle") return;
    expect(group.entries.map((x) => x.entryId)).toEqual(["b", "c", "d", "f", "g"]);
    expect(group.totalCents).toBe(-930);
  });

  it("places a group where its newest movement is, even with other rows in between", () => {
    const items = groupLedgerByCycle([e("a", "0.10", "c1"), e("b", "20.00", null), e("c", "-5.00", "c1")]);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("cycle");
    expect(items[1].kind).toBe("entry");
  });

  it("leaves a cycle with one movement and movements without a cycle as plain rows", () => {
    const items = groupLedgerByCycle([e("a", "-5.00", "c1"), e("b", "10.00", null), e("c", "10.00", null)]);
    expect(items.every((i) => i.kind === "entry")).toBe(true);
  });

  it("adds up in cents, without float drift", () => {
    const items = groupLedgerByCycle(Array.from({ length: 10 }, (_, i) => e(`x${i}`, "0.10", "c1")));
    expect(items[0].kind === "cycle" && items[0].totalCents).toBe(100);
  });

  it("keeps every movement exactly once", () => {
    const input = [e("a", "1.00", "c1"), e("b", "2.00", "c2"), e("c", "3.00", "c1"), e("d", "4.00", null), e("f", "5.00", "c2")];
    const ids = groupLedgerByCycle(input).flatMap((i) => (i.kind === "entry" ? [i.entry.entryId] : i.entries.map((x) => x.entryId)));
    expect(ids.sort()).toEqual(["a", "b", "c", "d", "f"]);
  });
});

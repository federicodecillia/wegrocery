import { describe, expect, it } from "vitest";
import { isAdjustment, summarizeCycleMoney, type CycleLedgerRow } from "./cycle-money";

let n = 0;
const row = (type: string, amount: string, extra: Partial<CycleLedgerRow> = {}): CycleLedgerRow => ({
  entryId: `led_${++n}`,
  memberName: "Socio",
  entryDate: new Date(2026, 9, n),
  note: null,
  replaces: null,
  paymentId: null,
  type,
  amount,
  ...extra,
});

describe("summarizeCycleMoney", () => {
  it("groups by kind in cycle order and sums in cents", () => {
    const m = summarizeCycleMoney([
      row("shipping_charge", "-1.50"),
      row("order_charge", "-17.90"),
      row("order_charge", "-5.00"),
      row("shipping_charge", "-1.50"),
      row("correction", "-0.10"),
      row("correction", "0.30"),
    ]);
    expect(m.lines).toEqual([
      { kind: "order", count: 2, cents: -2290 },
      { kind: "shipping", count: 2, cents: -300 },
      { kind: "adjustment", count: 1, cents: -10 },
      { kind: "refund", count: 1, cents: 30 },
    ]);
    expect(m.netCents).toBe(-2290 - 300 - 10 + 30);
  });

  it("lists corrections and replacements newest first, not the plain charges", () => {
    const a = row("correction", "-0.20");
    const b = row("shipping_charge", "-2.00", { replaces: "led_x" });
    const m = summarizeCycleMoney([row("order_charge", "-3.00"), a, b]);
    expect(m.adjustments.map((r) => r.entryId)).toEqual([b.entryId, a.entryId]);
  });

  it("is empty for a cycle with no movements", () => {
    expect(summarizeCycleMoney([])).toEqual({ lines: [], netCents: 0, adjustments: [] });
  });

  it("does not drift on many small amounts", () => {
    const m = summarizeCycleMoney(Array.from({ length: 10 }, () => row("order_charge", "-0.10")));
    expect(m.netCents).toBe(-100);
  });
});

describe("isAdjustment", () => {
  it("is a correction or a replacement", () => {
    expect(isAdjustment({ type: "correction", replaces: null })).toBe(true);
    expect(isAdjustment({ type: "order_charge", replaces: "led_1" })).toBe(true);
    expect(isAdjustment({ type: "order_charge", replaces: null })).toBe(false);
  });
});

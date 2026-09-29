import { describe, expect, it } from "vitest";
import {
  buildCycleHistory,
  type CycleHistoryEntry,
  type HistoryLedgerRow,
  type HistoryLineRow,
} from "./cycle-history";

function cycle(cycleId: string, status = "closed", createdAt = "2026-09-01T10:00:00Z") {
  return {
    cycleId,
    cycleTitle: `Ciclo ${cycleId}`,
    pickupDate: new Date("2026-09-10T16:00:00Z"),
    cycleStatus: status,
    cycleCreatedAt: new Date(createdAt),
  };
}

function line(
  c: ReturnType<typeof cycle>,
  productName: string,
  lineTotal: string,
  extra: Partial<HistoryLineRow> = {},
): HistoryLineRow {
  return {
    ...c,
    productName,
    variant: null,
    quantity: 1,
    unitPrice: lineTotal,
    lineTotal,
    actualQuantity: null,
    actualLineTotal: null,
    unit: null,
    supplierName: null,
    productSupplier: null,
    category: null,
    emoji: null,
    ...extra,
  };
}

// `shipping` is the cost charged, positive; `net` is signed like the ledger.
function ledger(c: ReturnType<typeof cycle>, net: string, shipping = "0"): HistoryLedgerRow {
  return { ...c, net, shipping };
}

// The four figures the Orders tab shows must add up to the ledger net.
function expectAddsUp(e: CycleHistoryEntry) {
  const cents = (n: number) => Math.round(n * 100);
  expect(cents(-e.productsTotal) - cents(e.shipping) + cents(e.corrections)).toBe(cents(e.net));
}

describe("buildCycleHistory", () => {
  it("shows an open cycle as a pending order total, not yet on the balance", () => {
    const open = cycle("cyc_open", "open");
    const [entry] = buildCycleHistory(
      [line(open, "Patate", "4.00"), line(open, "Carote", "16.00")],
      [],
    );
    expect(entry).toMatchObject({
      cycleId: "cyc_open",
      status: "open",
      charged: false,
      productsTotal: 20,
      shipping: 0,
      corrections: 0,
      net: 0,
    });
    expect(entry.lines.map((l) => l.productName)).toEqual(["Patate", "Carote"]);
  });

  it("shows the ledger as soon as it holds something, even on a cycle still open", () => {
    // Left open with its charges by the pre-atomic close.
    const reopened = cycle("cyc_reopened", "open");
    const [entry] = buildCycleHistory([line(reopened, "Patate", "4.00")], [ledger(reopened, "-4.00")]);
    expect(entry).toMatchObject({ charged: true, productsTotal: 4, corrections: 0, net: -4 });
    expectAddsUp(entry);
  });

  it("nets a closed cycle from the weighed products plus shipping", () => {
    const closed = cycle("cyc_closed");
    const [entry] = buildCycleHistory(
      [
        line(closed, "Patate", "4.00", { actualQuantity: "0.800", actualLineTotal: "3.20", unit: "kg" }),
        line(closed, "Carote", "16.00"),
      ],
      // order charge -20.00, weighing refund +0.80, shipping -2.00
      [ledger(closed, "-21.20", "2.00")],
    );
    expect(entry).toMatchObject({
      charged: true,
      productsTotal: 19.2,
      shipping: 2,
      corrections: 0,
      net: -21.2,
    });
    expect(entry.lines[0]).toMatchObject({
      lineTotal: 4,
      actualQuantity: 0.8,
      actualLineTotal: 3.2,
      unit: "kg",
    });
    expect(entry.lines[1]).toMatchObject({ lineTotal: 16, actualQuantity: null, actualLineTotal: null });
    expectAddsUp(entry);
  });

  it("shows a cancelled cycle's refund as a correction next to what was kept", () => {
    const cancelled = cycle("cyc_cancelled", "cancelled");
    // order -20.00, shipping -2.00, cancellation refund +20.00 (shipping kept)
    const [entry] = buildCycleHistory(
      [line(cancelled, "Patate", "20.00")],
      [ledger(cancelled, "-2.00", "2.00")],
    );
    expect(entry).toMatchObject({
      status: "cancelled",
      charged: true,
      productsTotal: 20,
      shipping: 2,
      corrections: 20,
      net: -2,
    });
    expectAddsUp(entry);
  });

  it("keeps a cycle whose order lines were all removed but still moved the balance", () => {
    const emptied = cycle("cyc_emptied");
    // order -20.00 refunded by the closed-order edit, shipping still charged
    const [entry] = buildCycleHistory([], [ledger(emptied, "-2.00", "2.00")]);
    expect(entry).toMatchObject({
      cycleId: "cyc_emptied",
      title: "Ciclo cyc_emptied",
      lines: [],
      charged: true,
      productsTotal: 0,
      shipping: 2,
      corrections: 0,
      net: -2,
    });
    expectAddsUp(entry);
  });

  it("lists cycles newest first, whichever query they came from", () => {
    const older = cycle("cyc_older", "closed", "2026-08-01T10:00:00Z");
    const middle = cycle("cyc_middle", "closed", "2026-08-15T10:00:00Z");
    const newest = cycle("cyc_newest", "open", "2026-09-01T10:00:00Z");
    const entries = buildCycleHistory(
      [line(newest, "Patate", "4.00"), line(older, "Carote", "3.00")],
      [ledger(older, "-3.00"), ledger(middle, "-1.00", "1.00")],
    );
    expect(entries.map((e) => e.cycleId)).toEqual(["cyc_newest", "cyc_middle", "cyc_older"]);
  });

  it("adds money in cents, without floating-point drift", () => {
    const closed = cycle("cyc_cents");
    const [entry] = buildCycleHistory(
      [line(closed, "A", "0.10"), line(closed, "B", "0.20")],
      [ledger(closed, "-0.30")],
    );
    expect(entry.productsTotal).toBe(0.3);
    expect(entry.corrections).toBe(0);
    expect(entry.net).toBe(-0.3);
  });

  it("falls back to the product's own supplier text when it has no supplier record", () => {
    const closed = cycle("cyc_supplier");
    const [entry] = buildCycleHistory(
      [
        line(closed, "Miele", "8.00", { supplierName: "Apicoltura Bianchi", productSupplier: "old text" }),
        line(closed, "Uova", "3.00", { productSupplier: "Cascina Rossi" }),
      ],
      [ledger(closed, "-11.00")],
    );
    expect(entry.lines.map((l) => l.supplierName)).toEqual(["Apicoltura Bianchi", "Cascina Rossi"]);
  });
});

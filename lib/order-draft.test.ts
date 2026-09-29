import { describe, expect, it } from "vitest";
import {
  DRAFT_MAX_LINES,
  draftSyncAction,
  normalizeDraftLines,
  orderLinesKey,
  resumeDraft,
  sameOrderLines,
} from "./order-draft";

describe("normalizeDraftLines", () => {
  it("keeps positive quantities, one line per product, sorted", () => {
    expect(
      normalizeDraftLines([
        { productId: "prd_b", quantity: 2 },
        { productId: "prd_a", quantity: 1 },
        { productId: "prd_c", quantity: 0 },
        { productId: "prd_b", quantity: 3 },
      ]),
    ).toEqual([
      { productId: "prd_a", quantity: 1 },
      { productId: "prd_b", quantity: 3 },
    ]);
    expect(normalizeDraftLines([])).toEqual([]);
  });

  it("refuses anything that is not a list of product quantities", () => {
    const bad: unknown[] = [
      null,
      "prd_a",
      { productId: "prd_a", quantity: 1 },
      [null],
      [{ quantity: 1 }],
      [{ productId: "", quantity: 1 }],
      [{ productId: "p".repeat(65), quantity: 1 }],
      [{ productId: "prd_a", quantity: 1.5 }],
      [{ productId: "prd_a", quantity: -1 }],
      [{ productId: "prd_a", quantity: 10000 }],
      [{ productId: "prd_a", quantity: "2" }],
      Array.from({ length: DRAFT_MAX_LINES + 1 }, (_, i) => ({ productId: `p${i}`, quantity: 1 })),
    ];
    for (const input of bad) expect(normalizeDraftLines(input)).toBeNull();
  });
});

describe("sameOrderLines", () => {
  it("ignores order and zero lines", () => {
    const a = [
      { productId: "prd_a", quantity: 1 },
      { productId: "prd_b", quantity: 2 },
    ];
    const b = [
      { productId: "prd_b", quantity: 2 },
      { productId: "prd_c", quantity: 0 },
      { productId: "prd_a", quantity: 1 },
    ];
    expect(sameOrderLines(a, b)).toBe(true);
    expect(orderLinesKey(a)).toBe(orderLinesKey(b));
    expect(sameOrderLines(a, [{ productId: "prd_a", quantity: 1 }])).toBe(false);
    expect(sameOrderLines([], [])).toBe(true);
  });
});

describe("resumeDraft", () => {
  const available = new Set(["prd_a", "prd_b"]);
  const confirmed = [{ productId: "prd_a", quantity: 1 }];

  it("has nothing to resume without a draft", () => {
    expect(resumeDraft(null, confirmed, available)).toBeNull();
  });

  it("has nothing to resume when the draft is the confirmed order", () => {
    expect(resumeDraft([{ productId: "prd_a", quantity: 1 }], confirmed, available)).toBeNull();
  });

  it("drops products no longer in the cycle and counts them", () => {
    expect(
      resumeDraft(
        [
          { productId: "prd_a", quantity: 2 },
          { productId: "prd_gone", quantity: 1 },
        ],
        confirmed,
        available,
      ),
    ).toEqual({ lines: [{ productId: "prd_a", quantity: 2 }], dropped: 1 });
  });

  it("compares with the confirmed lines the form can show", () => {
    const withGone = [...confirmed, { productId: "prd_gone", quantity: 1 }];
    expect(resumeDraft([{ productId: "prd_a", quantity: 1 }], withGone, available)).toBeNull();
  });

  it("resumes an emptied cart when an order was confirmed", () => {
    expect(resumeDraft([], confirmed, available)).toEqual({ lines: [], dropped: 0 });
  });
});

describe("draftSyncAction", () => {
  it("does nothing when the server already holds what the form shows", () => {
    expect(draftSyncAction("prd_a:1", "prd_a:1", "prd_a:1")).toBe("none");
    expect(draftSyncAction("prd_a:2", "prd_a:1", "prd_a:2")).toBe("none");
  });

  it("saves edits the server does not hold yet", () => {
    expect(draftSyncAction("prd_a:2", "prd_a:1", "prd_a:1")).toBe("save");
    expect(draftSyncAction("prd_a:3", "prd_a:1", "prd_a:2")).toBe("save");
  });

  it("drops the draft once the form is back to the confirmed order", () => {
    expect(draftSyncAction("prd_a:1", "prd_a:1", "prd_a:2")).toBe("discard");
  });
});

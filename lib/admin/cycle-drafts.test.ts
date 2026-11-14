import { describe, expect, it } from "vitest";
import { summarizeCycleDrafts } from "./cycle-drafts";

describe("summarizeCycleDrafts", () => {
  const products = [{ productId: "prd_apples", unitPrice: "2.50" }, { productId: "prd_rice", unitPrice: "3.20" }];
  const updatedAt = new Date("2026-11-14T09:00:00Z");
  const draft = {
    memberId: "mem_test",
    name: "Test Member",
    lines: [{ productId: "prd_apples", quantity: 2 }],
    updatedAt,
  };
  const confirmed = new Map([[draft.memberId, [{ productId: "prd_apples", quantity: 1 }]]]);

  it("summarizes a new order using current product prices", () => {
    expect(summarizeCycleDrafts([draft], products, new Map())).toEqual([{
      memberId: draft.memberId,
      name: draft.name,
      kind: "new",
      estimatedTotal: 5,
      lineCount: 1,
      updatedAt,
    }]);
  });

  it("identifies changes to a confirmed order", () => {
    const [summary] = summarizeCycleDrafts([{
      ...draft,
      lines: [...draft.lines, { productId: "prd_rice", quantity: 3 }],
    }], products, confirmed);
    expect(summary.kind).toBe("changes");
    expect(summary.estimatedTotal).toBeCloseTo(14.6);
    expect(summary.lineCount).toBe(2);
  });

  it("excludes a draft equal to the confirmed order", () => {
    expect(summarizeCycleDrafts([draft], products, new Map([[draft.memberId, draft.lines]]))).toEqual([]);
  });

  it("excludes removed products from the estimate and line count", () => {
    const [summary] = summarizeCycleDrafts([{
      ...draft,
      lines: [...draft.lines, { productId: "prd_removed", quantity: 50 }],
    }], products, confirmed);
    expect(summary).toMatchObject({ kind: "changes", estimatedTotal: 5, lineCount: 1 });
  });

  it("excludes a draft that matches after removed products are dropped", () => {
    expect(summarizeCycleDrafts([{
      ...draft,
      lines: [...draft.lines, { productId: "prd_removed", quantity: 50 }],
    }], products, new Map([[draft.memberId, draft.lines]]))).toEqual([]);
    expect(summarizeCycleDrafts([{
      ...draft,
      lines: [{ productId: "prd_removed", quantity: 1 }],
    }], products, new Map())).toEqual([]);
  });

  it("excludes an empty new draft but keeps an emptied confirmed order", () => {
    expect(summarizeCycleDrafts([{ ...draft, lines: [] }], products, new Map())).toEqual([]);
    expect(summarizeCycleDrafts([{ ...draft, lines: [] }], products, confirmed)).toEqual([{
      memberId: draft.memberId,
      name: draft.name,
      kind: "changes",
      estimatedTotal: 0,
      lineCount: 0,
      updatedAt,
    }]);
    expect(summarizeCycleDrafts([{ ...draft, lines: null }], products, confirmed)).toEqual([]);
  });

  it("sorts the latest edits first without reordering its input", () => {
    const drafts = [draft, { ...draft, memberId: "mem_recent", updatedAt: new Date("2026-11-14T10:00:00Z") }];
    expect(summarizeCycleDrafts(drafts, products, new Map()).map((row) => row.memberId)).toEqual(["mem_recent", draft.memberId]);
    expect(drafts[0]).toBe(draft);
  });
});

import { afterAll, beforeAll, expect, it } from "vitest";
import { getCycleDrafts, getOpenCycleStats } from "@/lib/db/queries";
import { describeDb, makeScope } from "@/test/int/fixtures";

describeDb("cycle draft summaries", () => {
  const scope = makeScope("cycledrafts");
  const { sql } = scope;
  let editingMemberId: string;

  beforeAll(async () => {
    await scope.createMember();
    editingMemberId = await scope.createExtraMember("editing");
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("returns a new draft and unconfirmed changes with names and no email fields", async () => {
    const { cycleId, productIds: [productId] } = await scope.createCycle("drafts", {
      products: [{ name: "Test Apples", unitPrice: 2.5 }],
    });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity,
        unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("confirmed")}, ${cycleId}, ${editingMemberId}, ${productId}, 1, 2.5, 2.5, now())`;
    await sql`INSERT INTO order_drafts (cycle_id, member_id, lines, updated_at) VALUES
      (${cycleId}, ${scope.memberId}, ${JSON.stringify([{ productId, quantity: 2 }])}::jsonb, '2026-11-14T09:00:00Z'),
      (${cycleId}, ${editingMemberId}, ${JSON.stringify([{ productId, quantity: 3 }])}::jsonb, '2026-11-14T10:00:00Z')`;

    const drafts = await getCycleDrafts(cycleId);
    expect(drafts).toEqual([
      {
        memberId: editingMemberId,
        name: `${scope.memberName} editing`,
        kind: "changes",
        estimatedTotal: 7.5,
        lineCount: 1,
        updatedAt: new Date("2026-11-14T10:00:00Z"),
      },
      {
        memberId: scope.memberId,
        name: scope.memberName,
        kind: "new",
        estimatedTotal: 5,
        lineCount: 1,
        updatedAt: new Date("2026-11-14T09:00:00Z"),
      },
    ]);
    for (const draft of drafts) {
      expect(Object.keys(draft).some((key) => /email/i.test(key))).toBe(false);
    }
    expect(await getOpenCycleStats(cycleId)).toMatchObject({
      orderCount: 1,
      grandTotal: 2.5,
      unpaidDrafts: drafts.length,
      pendingPayments: 0,
      drafts,
    });
  });

  it("counts only resumable drafts, excluding equal lines and unavailable products", async () => {
    const { cycleId, productIds: [productId, removedId] } = await scope.createCycle("excluded", {
      products: [{ name: "Test Rice", unitPrice: 3 }, { name: "Test Removed", unitPrice: 8 }],
    });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity,
        unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("equal")}, ${cycleId}, ${editingMemberId}, ${productId}, 1, 3, 3, now())`;
    await sql`UPDATE products SET active = false WHERE product_id = ${removedId}`;
    await sql`INSERT INTO order_drafts (cycle_id, member_id, lines, updated_at) VALUES
      (${cycleId}, ${editingMemberId}, ${JSON.stringify([{ productId, quantity: 1 }, { productId: removedId, quantity: 2 }])}::jsonb, now()),
      (${cycleId}, ${scope.memberId}, ${JSON.stringify([{ productId: removedId, quantity: 1 }])}::jsonb, now())`;

    expect(await getCycleDrafts(cycleId)).toEqual([]);
    expect(await getOpenCycleStats(cycleId)).toMatchObject({ orderCount: 1, grandTotal: 3, unpaidDrafts: 0, drafts: [] });
  });
});

import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { readMemberOrderLines, replaceOpenOrder } from "./open-order-store";

// An admin replacing a member's order on an open cycle, on a real database:
// after the deadline too, never once the cycle is closed or the lines changed,
// and never a ledger row (the close charges the order).
describeDb("admin order on an open cycle", () => {
  const scope = makeScope("openord");
  const { sql } = scope;
  const products = [
    { name: "Bread", unitPrice: 4 },
    { name: "Oil", unitPrice: 9.5 },
  ];

  async function orders(cycleId: string) {
    const rows = await sql`SELECT product_id, quantity, line_total::text AS total FROM orders
      WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId} ORDER BY product_id`;
    return rows.map((o) => `${o.product_id} x${o.quantity} = ${o.total}`);
  }

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("adds an order after the deadline, drops the draft and writes no ledger row", async () => {
    const { cycleId, productIds } = await scope.createCycle("late", { products });
    await sql`UPDATE order_cycles SET order_close_at = now() - interval '1 hour' WHERE cycle_id = ${cycleId}`;
    await sql`INSERT INTO order_drafts (member_id, cycle_id, lines, updated_at)
      VALUES (${scope.memberId}, ${cycleId}, '[]'::jsonb, now())`;

    const result = await replaceOpenOrder(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [
        { productId: productIds[0], quantity: 2, unitPrice: "4.00" },
        { productId: productIds[1], quantity: 1, unitPrice: "9.50" },
      ],
      expected: [],
    });
    expect(result).toBe("saved");
    expect(await orders(cycleId)).toEqual([`${productIds[0]} x2 = 8.00`, `${productIds[1]} x1 = 9.50`]);
    const drafts = await sql`SELECT 1 FROM order_drafts WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId}`;
    expect(drafts).toEqual([]);
    const ledger = await sql`SELECT 1 FROM ledger_entries WHERE member_id = ${scope.memberId} AND cycle_id = ${cycleId}`;
    expect(ledger).toEqual([]);
  });

  it("replaces an existing order and removes it with no lines", async () => {
    const { cycleId, productIds } = await scope.createCycle("edit", { products });
    await replaceOpenOrder(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 1, unitPrice: "4.00" }],
      expected: [],
    });

    const before = await readMemberOrderLines(getDb(), scope.memberId, cycleId);
    expect(
      await replaceOpenOrder(getDb(), {
        memberId: scope.memberId,
        cycleId,
        lines: [{ productId: productIds[1], quantity: 3, unitPrice: "9.50" }],
        expected: before,
      }),
    ).toBe("saved");
    expect(await orders(cycleId)).toEqual([`${productIds[1]} x3 = 28.50`]);

    const again = await readMemberOrderLines(getDb(), scope.memberId, cycleId);
    expect(await replaceOpenOrder(getDb(), { memberId: scope.memberId, cycleId, lines: [], expected: again })).toBe(
      "saved",
    );
    expect(await orders(cycleId)).toEqual([]);
  });

  it("writes nothing when the member's lines changed since they were read", async () => {
    const { cycleId, productIds } = await scope.createCycle("stale", { products });
    const seen = await readMemberOrderLines(getDb(), scope.memberId, cycleId);
    // The member saves meanwhile.
    await replaceOpenOrder(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 1, unitPrice: "4.00" }],
      expected: seen,
    });

    const result = await replaceOpenOrder(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[1], quantity: 5, unitPrice: "9.50" }],
      expected: seen,
    });
    expect(result).toBe("changed");
    expect(await orders(cycleId)).toEqual([`${productIds[0]} x1 = 4.00`]);
  });

  it("writes nothing once the cycle is closed", async () => {
    const { cycleId, productIds } = await scope.createCycle("closed", { products });
    await sql`UPDATE order_cycles SET status = 'closed' WHERE cycle_id = ${cycleId}`;

    const result = await replaceOpenOrder(getDb(), {
      memberId: scope.memberId,
      cycleId,
      lines: [{ productId: productIds[0], quantity: 1, unitPrice: "4.00" }],
      expected: [],
    });
    expect(result).toBe("changed");
    expect(await orders(cycleId)).toEqual([]);
  });
});

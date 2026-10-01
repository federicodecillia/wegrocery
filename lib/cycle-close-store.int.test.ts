import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { closeGuardSql, performCycleClose, setOpenCycleFee } from "./cycle-close-store";

// Closing a cycle on a real database: products, shipping and the order
// preparation fee in one batch, a single close, and a fee that cannot move
// under it.
describeDb("cycle close", () => {
  const scope = makeScope("close");
  const { sql } = scope;
  const admin = "admin@example.invalid";
  let other: string;
  let lines = 0;

  beforeAll(async () => {
    await scope.createMember();
    other = await scope.createExtraMember("other");
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  async function order(cycleId: string, productId: string, member: string, quantity: number, unitPrice: number) {
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id(`line${++lines}`)}, ${cycleId}, ${member}, ${productId}, ${quantity}, ${unitPrice},
        ${(quantity * unitPrice).toFixed(2)}, now())`;
  }

  async function charges(cycleId: string) {
    return sql`SELECT member_id, type, amount::text AS amount, note, created_at FROM ledger_entries
      WHERE cycle_id = ${cycleId} ORDER BY member_id, type`;
  }

  it("charges products, shipping and the fee in one batch, at the same instant", async () => {
    const { cycleId, productIds } = await scope.createCycle("fee", {
      fee: { type: "percent", value: 10 },
      shippingCostPerMember: 2,
      products: [{ name: "Bread", unitPrice: 10.05 }],
    });
    await order(cycleId, productIds[0], scope.memberId, 1, 10.05);
    await order(cycleId, productIds[0], other, 2, 10.05);

    expect(await performCycleClose(getDb(), cycleId, admin)).toEqual({ chargesGenerated: 2 });

    const rows = await charges(cycleId);
    const mine = rows.filter((r) => r.member_id === scope.memberId);
    expect(mine.map((r) => [r.type, r.amount])).toEqual([
      ["handling_charge", "-1.01"],
      ["order_charge", "-10.05"],
      ["shipping_charge", "-2.00"],
    ]);
    expect(mine[0].note).toContain("10%");
    expect(rows.find((r) => r.member_id === other && r.type === "handling_charge")?.amount).toBe("-2.01");
    expect(new Set(rows.map((r) => new Date(r.created_at).getTime())).size).toBe(1);
  });

  it("writes no fee row on a cycle without a fee", async () => {
    const { cycleId, productIds } = await scope.createCycle("nofee", { products: [{ name: "Milk", unitPrice: 3 }] });
    await order(cycleId, productIds[0], scope.memberId, 1, 3);
    await performCycleClose(getDb(), cycleId, admin);
    expect((await charges(cycleId)).map((r) => r.type)).toEqual(["order_charge"]);
  });

  it("closes once: a second close is refused and writes nothing", async () => {
    const { cycleId, productIds } = await scope.createCycle("twice", {
      fee: { type: "fixed", value: 1 },
      products: [{ name: "Eggs", unitPrice: 4 }],
    });
    await order(cycleId, productIds[0], scope.memberId, 1, 4);
    await performCycleClose(getDb(), cycleId, admin);
    await expect(performCycleClose(getDb(), cycleId, admin)).rejects.toThrow();
    expect(await charges(cycleId)).toHaveLength(2);
  });

  it("charges the fee on the re-priced lines of a close with adjustments", async () => {
    const { cycleId, productIds } = await scope.createCycle("repriced", {
      fee: { type: "percent", value: 10 },
      products: [{ name: "Salad", unitPrice: 5 }],
    });
    await order(cycleId, productIds[0], scope.memberId, 2, 5);
    // What adminCloseCycleWithAdjustments does before closing: 5.00 becomes 6.25.
    await sql`UPDATE orders SET unit_price_snapshot = 6.25, line_total = quantity * 6.25 WHERE cycle_id = ${cycleId}`;
    await performCycleClose(getDb(), cycleId, admin);
    expect((await charges(cycleId)).map((r) => [r.type, r.amount])).toEqual([
      ["handling_charge", "-1.25"],
      ["order_charge", "-12.50"],
    ]);
  });

  it("aborts the close batch when the fee changed after it was read", async () => {
    const { cycleId } = await scope.createCycle("guard", { fee: { type: "percent", value: 10 } });
    const read = { type: "percent", value: "10.00" };
    await expect(getDb().execute(closeGuardSql(cycleId, "{}", read))).resolves.toBeDefined();
    await setOpenCycleFee(getDb(), cycleId, { type: "percent", value: 5 });
    await expect(getDb().execute(closeGuardSql(cycleId, "{}", read))).rejects.toThrow(/division by zero|22012/);
  });

  it("changes the fee of an open cycle, never of a closed one", async () => {
    const { cycleId } = await scope.createCycle("setfee", { fee: { type: "percent", value: 10 } });
    expect(await setOpenCycleFee(getDb(), cycleId, null)).toBe(true);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    expect(await setOpenCycleFee(getDb(), cycleId, { type: "fixed", value: 1 })).toBe(false);
    const [c] = await sql`SELECT handling_fee_type, handling_fee_value FROM order_cycles WHERE cycle_id = ${cycleId}`;
    expect(c).toEqual({ handling_fee_type: null, handling_fee_value: null });
  });
});

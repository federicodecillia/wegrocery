import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope, runSql } from "./fixtures";

// drizzle/0021_pay_per_order.sql on a real database: it can run again on a
// migrated database, and its constraints reject what the app must never write.
describeDb("migration 0021 (pay per order)", () => {
  const scope = makeScope("m0021");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("applies again without errors", async () => {
    const statements = readFileSync("drizzle/0021_pay_per_order.sql", "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBe(6);
    for (const statement of statements) await runSql(statement);
  });

  it("keeps existing cycles and payments valid: wallet and topup by default", async () => {
    const { cycleId } = await scope.createCycle("w");
    const { paymentId } = await scope.createPaidTopup("t", 1000);
    const [c] = await sql`SELECT payment_mode, handling_fee_type FROM order_cycles WHERE cycle_id = ${cycleId}`;
    const [p] = await sql`SELECT kind, cycle_id FROM payments WHERE payment_id = ${paymentId}`;
    expect(c).toEqual({ payment_mode: "wallet", handling_fee_type: null });
    expect(p).toEqual({ kind: "topup", cycle_id: null });
  });

  it("rejects a per_order cycle without its fee, and a percentage above 100", async () => {
    await expect(scope.createCycle("nofee", { paymentMode: "per_order", fee: null })).rejects.toThrow(
      /order_cycles_per_order_fee_check/,
    );
    await expect(
      scope.createCycle("bigfee", { paymentMode: "per_order", fee: { type: "percent", value: 101 } }),
    ).rejects.toThrow(/order_cycles_handling_fee_value_check/);
  });

  it("rejects an order payment without its cycle and snapshot", async () => {
    await expect(
      sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency, created_at,
          updated_at, kind)
        VALUES (${scope.id("pay_bad")}, ${scope.memberId}, 'stripe', 'pending', 1000, 'eur', now(), now(), 'order')`,
    ).rejects.toThrow(/payments_order_complete_check/);
  });

  it("credits an order payment at most once per cycle", async () => {
    const { cycleId } = await scope.createCycle("po", { paymentMode: "per_order" });
    const { paymentId } = await scope.createPaidTopup("o", 1000);
    const credit = (entry: string) =>
      sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, created_by,
          created_at, payment_id)
        VALUES (${scope.id(entry)}, ${scope.memberId}, now(), 'order_payment', 10, ${cycleId}, 'stripe', now(),
          ${paymentId})`;
    await credit("led_once");
    await expect(credit("led_twice")).rejects.toThrow(/ledger_entries_payment_cycle_credit_uniq/);
  });
});

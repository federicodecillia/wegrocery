import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { INVARIANT_CHECKS } from "./invariants";

// Each check finds the break it describes, and nothing in consistent rows.
describeDb("money invariants", () => {
  const scope = makeScope("inv");
  const { sql } = scope;

  async function breaks(): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    for (const check of INVARIANT_CHECKS) {
      const { rows } = await getDb().execute<{ id: string }>(check.query);
      out[check.name] = rows.map((r) => r.id).filter((id) => id.includes(scope.prefix));
    }
    return out;
  }

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("finds nothing in consistent rows", async () => {
    const { cycleId } = await scope.createCycle("ok", { paymentMode: "per_order" });
    await scope.createPaidTopup("ok", 1000);
    await scope.createPaidOrderPayment("okorder", cycleId, 800);
    expect(Object.values(await breaks()).flat()).toEqual([]);
  });

  it("finds each kind of break", async () => {
    const { cycleId, productIds } = await scope.createCycle("bad", { paymentMode: "per_order", products: [{ name: "Bread", unitPrice: 4 }] });
    // A paid top-up whose refunded_cents does not match any refund.
    const t = await scope.createPaidTopup("drift", 1000);
    await sql`UPDATE payments SET refunded_cents = 300 WHERE payment_id = ${t.paymentId}`;
    // An accepted refund with no debit.
    const o = await scope.createPaidOrderPayment("nodebit", cycleId, 500);
    await sql`INSERT INTO refunds (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
        created_by, created_at, updated_at)
      VALUES (${scope.id("ref_nodebit")}, ${o.paymentId}, ${scope.memberId}, ${cycleId}, 500, 'succeeded',
        'order_cancelled', 'system', now(), now())`;
    await sql`UPDATE payments SET refunded_cents = 500, status = 'refunded' WHERE payment_id = ${o.paymentId}`;
    // A paid payment never credited.
    const p = await scope.createPendingOrderPayment("nocredit", cycleId, 700, []);
    await sql`UPDATE payments SET status = 'succeeded' WHERE payment_id = ${p.paymentId}`;
    // An order on a closed cycle with no charge.
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id("line")}, ${cycleId}, ${scope.memberId}, ${productIds[0]}, 1, 4, 4, now())`;
    await sql`UPDATE order_cycles SET status = 'closed' WHERE cycle_id = ${cycleId}`;
    // Someone else on the cycle was charged: the cycle went through the app's close.
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, created_by, created_at)
      SELECT ${scope.id("other_charge")}, member_id, now(), 'order_charge', -1, ${cycleId}, 'int-test', now()
      FROM members WHERE member_id <> ${scope.memberId} LIMIT 1`;

    const found = await breaks();
    expect(found.payment_refunded_cents).toEqual([t.paymentId]);
    expect(found.refund_debit).toEqual([scope.id("ref_nodebit")]);
    expect(found.paid_payment_credit).toEqual([p.paymentId]);
    expect(found.closed_cycle_charge).toEqual([`${cycleId}:${scope.memberId}`]);
  });
});

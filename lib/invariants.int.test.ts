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

  it("checks balance payments and settled pay-per-order cycles", async () => {
    const { cycleId } = await scope.createCycle("settled", { paymentMode: "per_order" });
    await scope.createPaidOrderPayment("set", cycleId, 1000);
    await scope.addLedger("set_oc", scope.memberId, "order_charge", -8, cycleId);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now(), settled_at = now() WHERE cycle_id = ${cycleId}`;
    // A balance payment credited for less than it took.
    const balanceId = scope.id("bal");
    await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency, refunded_cents,
        checkout_session_id, created_at, updated_at, kind)
      VALUES (${balanceId}, ${scope.memberId}, 'stripe', 'succeeded', 500, 'eur', 0, ${`cs_${balanceId}`}, now(), now(),
        'balance')`;
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by, created_at, payment_id)
      VALUES (${scope.id("led_bal")}, ${scope.memberId}, now(), 'balance_payment', 3, 'int-test', 'stripe', now(), ${balanceId})`;
    const found = await breaks();
    expect(found.paid_balance_credit).toEqual([balanceId]);
    // 2 € left on a settled cycle with no refund asked for.
    expect(found.settled_cycle_credit).toEqual([`${cycleId}:${scope.memberId}`]);
    await scope.createRequestedRefund(`settle_${scope.id("set")}_1`, `${scope.prefix}_pay_set`, cycleId, 200, "settlement");
    expect((await breaks()).settled_cycle_credit).toEqual([]);
  });

  it("accepts an order charged by hand in Cassa after the close", async () => {
    const { cycleId, productIds } = await scope.createCycle("manual", { products: [{ name: "Pears", unitPrice: 4 }] });
    const other = await scope.createExtraMember("other");
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot,
        line_total, updated_at)
      VALUES (${scope.id("mline")}, ${cycleId}, ${scope.memberId}, ${productIds[0]}, 2, 4, 8, now())`;
    await sql`UPDATE order_cycles SET status = 'closed' WHERE cycle_id = ${cycleId}`;
    await scope.addLedger("m_other", other, "order_charge", -5, cycleId);
    await scope.addLedger("m_hand", scope.memberId, "correction", -8, cycleId);
    expect((await breaks()).closed_cycle_charge).not.toContain(`${cycleId}:${scope.memberId}`);
  });
});

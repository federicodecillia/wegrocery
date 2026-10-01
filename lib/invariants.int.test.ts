import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { handlingFeeCentsSql, INVARIANT_CHECKS } from "./invariants";
import { handlingFeeCents } from "./payments/order-payment";

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

  it("recomputes the fee in SQL exactly like handlingFeeCents", async () => {
    const cases: [number, "percent" | "fixed", string][] = [
      [2000, "percent", "10.00"], [1005, "percent", "10.00"], [1004, "percent", "10.00"],
      [1000, "percent", "1.25"], [333, "percent", "7.50"], [9_999_999, "percent", "25.00"],
      [500, "fixed", "1.50"], [500, "fixed", "0.29"], [0, "percent", "10.00"],
    ];
    for (const [base, type, value] of cases) {
      const { rows } = await getDb().execute<{ cents: string }>(
        dsql`SELECT (${handlingFeeCentsSql(dsql`${base}::numeric`, dsql`${type}::text`, dsql`${value}::numeric`)})::text AS cents`,
      );
      expect(Number(rows[0].cents)).toBe(handlingFeeCents(base, { type, value: Number(value) }));
    }
  });

  it("checks the order preparation fee of every close, to the cent", async () => {
    const other = await scope.createExtraMember("fee_other");
    const at = "2026-10-01T10:00:00Z";
    const insert = (name: string, member: string, type: string, amount: number, cycleId: string) =>
      sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, created_by, created_at)
        VALUES (${scope.id(name)}, ${member}, ${at}, ${type}, ${amount}, ${cycleId}, 'int-test', ${at})`;
    const closedCycle = async (name: string, fee: { type: "percent" | "fixed"; value: number } | null) => {
      const { cycleId } = await scope.createCycle(name, { fee });
      await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
      return cycleId;
    };

    // Right: 10% of 10.05 is 1.01, at the instant of the order charge.
    const ok = await closedCycle("fee_ok", { type: "percent", value: 10 });
    await insert("ok_oc", scope.memberId, "order_charge", -10.05, ok);
    await insert("ok_hc", scope.memberId, "handling_charge", -1.01, ok);
    // Wrong amount.
    const wrong = await closedCycle("fee_wrong", { type: "percent", value: 10 });
    await insert("w_oc", scope.memberId, "order_charge", -10.05, wrong);
    await insert("w_hc", scope.memberId, "handling_charge", -1.0, wrong);
    // One member charged, the other missing.
    const missing = await closedCycle("fee_missing", { type: "fixed", value: 1 });
    await insert("m_oc1", scope.memberId, "order_charge", -4, missing);
    await insert("m_hc1", scope.memberId, "handling_charge", -1, missing);
    await insert("m_oc2", other, "order_charge", -6, missing);
    // A fee on a cycle that has none.
    const nofee = await closedCycle("fee_none", null);
    await insert("n_oc", scope.memberId, "order_charge", -5, nofee);
    await insert("n_hc", scope.memberId, "handling_charge", -0.5, nofee);
    // Closed before B3, or every fee rounded to zero: no handling_charge at all, not checked.
    const legacy = await closedCycle("fee_legacy", { type: "percent", value: 10 });
    await insert("l_oc", scope.memberId, "order_charge", -10, legacy);

    const found = (await breaks()).handling_charge_matches;
    expect(found).toContain(`${wrong}:${scope.memberId}`);
    expect(found).toContain(`${missing}:${other}`);
    expect(found).toContain(`${nofee}:${scope.memberId}`);
    expect(found).not.toContain(`${ok}:${scope.memberId}`);
    expect(found).not.toContain(`${missing}:${scope.memberId}`);
    expect(found.some((id) => id.startsWith(legacy))).toBe(false);
  });
});

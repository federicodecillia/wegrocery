import type Stripe from "stripe";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { INVARIANT_CHECKS } from "@/lib/invariants";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { getConsolidatedBalanceCents, getWalletOffset } from "./balance-due";
import { applyOrderCredit } from "./order-credit";
import { cancelOrderWrite, confirmOrderWithoutPayment, getCycleCoverageCents } from "./order-confirm";
import { previewSettlement } from "./settlement-store";
import { planWebhookAction } from "./webhook";

// The wallet in card payments (drizzle/0042_card_settles_wallet.sql) on a
// real database: a payment that also pays the wallet debt, one that uses the
// wallet credit, an order the credit covers alone, the cancel that gives the
// credit back, a payment that lands after the close, and the settlement that
// never sends the debt part back to the card. Every case leaves the nightly
// checks clean.
describeDb("wallet in card payments", () => {
  const scope = makeScope("walcard");
  const { sql } = scope;
  const db = () => getDb();

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  async function breaks(): Promise<string[]> {
    const out: string[] = [];
    for (const check of INVARIANT_CHECKS) {
      const { rows } = await db().execute<{ id: string }>(check.query);
      for (const r of rows) if (r.id.includes(scope.prefix)) out.push(`${check.name}: ${r.id}`);
    }
    return out;
  }

  // What startOrderPayment writes before sending the member to Stripe.
  async function pendingPayment(
    name: string,
    member: string,
    cycleId: string,
    productId: string,
    amount: { chargeCents: number; balanceCents: number; walletCreditCents: number },
  ) {
    const paymentId = scope.id(`pay_${name}`);
    const sessionId = `cs_${paymentId}`;
    const snapshot = { ...amount, lines: [{ productId, quantity: 1, unitPriceCents: 3000 }] };
    await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, balance_cents, currency,
        refunded_cents, checkout_session_id, created_at, updated_at, kind, cycle_id, order_snapshot)
      VALUES (${paymentId}, ${member}, 'stripe', 'pending', ${amount.chargeCents}, ${amount.balanceCents}, 'eur', 0,
        ${sessionId}, now(), now(), 'order', ${cycleId}, ${JSON.stringify(snapshot)}::jsonb)`;
    const event = {
      id: `evt_${sessionId}`,
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: sessionId,
          metadata: { paymentId, memberId: member, cycleId, kind: "order" },
          payment_status: "paid",
          amount_total: amount.chargeCents,
          currency: "eur",
          payment_intent: `pi_${paymentId}`,
        },
      },
    } as unknown as Stripe.Event;
    const action = planWebhookAction(event);
    if (action.kind !== "order_credit") throw new Error(`planned ${action.kind}`);
    return { paymentId, action };
  }

  async function ledgerOf(member: string) {
    const rows = await sql`SELECT type, amount::text AS amount, cycle_id FROM ledger_entries
      WHERE member_id = ${member} AND type <> 'manual_charge' AND type <> 'topup'
      ORDER BY type, cycle_id NULLS FIRST, amount`;
    return rows.map((r) => `${r.type} ${r.amount} ${r.cycle_id ? "cycle" : "wallet"}`);
  }

  const onePerOrderCycle = (name: string) =>
    scope.createCycle(name, { paymentMode: "per_order", fee: { type: "fixed", value: 0 }, products: [{ name: "Box", unitPrice: 30 }] });

  it("books a payment that also paid the wallet debt as two separate lines", async () => {
    const member = await scope.createExtraMember("debt");
    await scope.addLedger("debt_charge", member, "manual_charge", -10, null);
    expect(await getWalletOffset(db(), member, { enabled: true, paysOffline: false })).toEqual({ debtCents: 1000, creditCents: 0 });
    const { cycleId, productIds } = await onePerOrderCycle("debt");
    const { action } = await pendingPayment("debt", member, cycleId, productIds[0], {
      chargeCents: 4000,
      balanceCents: 1000,
      walletCreditCents: 0,
    });

    await applyOrderCredit(action, null);
    await applyOrderCredit(action, null); // a replay changes nothing

    expect(await ledgerOf(member)).toEqual(["balance_payment 10.00 wallet", "order_payment 30.00 cycle"]);
    expect(await getConsolidatedBalanceCents(db(), member)).toBe(0);
    expect(await getCycleCoverageCents(db(), member, cycleId)).toBe(3000);
    expect(await breaks()).toEqual([]);
  });

  it("moves the wallet credit onto the cycle when the money lands, as far as the wallet still holds it", async () => {
    const member = await scope.createExtraMember("credit");
    await scope.addLedger("credit_topup", member, "topup", 20, null);
    const { cycleId, productIds } = await onePerOrderCycle("credit");
    const { action } = await pendingPayment("credit", member, cycleId, productIds[0], {
      chargeCents: 1000,
      balanceCents: 0,
      walletCreditCents: 2000,
    });
    await applyOrderCredit(action, null);

    expect(await ledgerOf(member)).toEqual([
      "order_payment 10.00 cycle",
      "wallet_transfer -20.00 wallet",
      "wallet_transfer 20.00 cycle",
    ]);
    expect(await getConsolidatedBalanceCents(db(), member)).toBe(0);
    expect(await getCycleCoverageCents(db(), member, cycleId)).toBe(3000);
    expect(await breaks()).toEqual([]);

    // Cancelling gives back the card payment (order part) and the credit at once.
    const cancelled = await cancelOrderWrite(db(), member, cycleId, "Box");
    expect(cancelled).toEqual({ status: "cancelled", refundIds: [`cancel_${scope.id("pay_credit")}_1`] });
    const [refund] = await sql`SELECT amount_cents FROM refunds WHERE payment_id = ${scope.id("pay_credit")}`;
    expect(refund.amount_cents).toBe(1000);
    expect(await getConsolidatedBalanceCents(db(), member)).toBe(2000);
    expect(await getCycleCoverageCents(db(), member, cycleId)).toBe(0);
    expect(await breaks()).toEqual([]);
  });

  it("uses only the credit still there when the wallet dropped during the Checkout", async () => {
    const member = await scope.createExtraMember("drop");
    await scope.addLedger("drop_topup", member, "topup", 20, null);
    const { cycleId, productIds } = await onePerOrderCycle("drop");
    const { action } = await pendingPayment("drop", member, cycleId, productIds[0], {
      chargeCents: 1000,
      balanceCents: 0,
      walletCreditCents: 2000,
    });
    await scope.addLedger("drop_charge", member, "manual_charge", -15, null);
    await applyOrderCredit(action, null);

    expect(await getConsolidatedBalanceCents(db(), member)).toBe(0);
    // 5 € of credit moved: 15 € stay to pay on the cycle, for the settlement.
    expect(await getCycleCoverageCents(db(), member, cycleId)).toBe(1500);
    expect(await breaks()).toEqual([]);
  });

  it("confirms an order the credit covers alone, and refuses when the credit is gone", async () => {
    const member = await scope.createExtraMember("cover");
    await scope.addLedger("cover_topup", member, "topup", 40, null);
    const { cycleId, productIds } = await onePerOrderCycle("cover");
    const lines = [{ productId: productIds[0], quantity: 1, unitPrice: "30.00" }];

    const tooMuch = await confirmOrderWithoutPayment(db(), {
      memberId: member,
      cycleId,
      lines,
      expectedCoveredCents: 0,
      walletCreditCents: 5000,
    });
    expect(tooMuch).toBe("changed");
    expect(await ledgerOf(member)).toEqual([]);

    const ok = await confirmOrderWithoutPayment(db(), {
      memberId: member,
      cycleId,
      cycleTitle: "Box",
      lines,
      expectedCoveredCents: 0,
      walletCreditCents: 3000,
    });
    expect(ok).toBe("confirmed");
    expect(await getConsolidatedBalanceCents(db(), member)).toBe(1000);
    expect(await getCycleCoverageCents(db(), member, cycleId)).toBe(3000);
    const orders = await sql`SELECT quantity FROM orders WHERE member_id = ${member} AND cycle_id = ${cycleId}`;
    expect(orders).toHaveLength(1);
    expect(await breaks()).toEqual([]);
  });

  it("keeps the credit for wallet orders not charged yet", async () => {
    const member = await scope.createExtraMember("pending");
    await scope.addLedger("pending_topup", member, "topup", 20, null);
    const { cycleId: walletCycle, productIds } = await scope.createCycle("pendingw", { products: [{ name: "Eggs", unitPrice: 6 }] });
    await sql`INSERT INTO orders (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
      VALUES (${scope.id("pending_line")}, ${walletCycle}, ${member}, ${productIds[0]}, 1, 6, 6, now())`;
    expect(await getWalletOffset(db(), member, { enabled: true, paysOffline: false })).toEqual({ debtCents: 0, creditCents: 1400 });
    expect(await getWalletOffset(db(), member, { enabled: false, paysOffline: false })).toEqual({ debtCents: 0, creditCents: 0 });
  });

  it("refunds only the order part of a payment that lands after the close, the debt stays paid", async () => {
    const member = await scope.createExtraMember("late");
    await scope.addLedger("late_charge", member, "manual_charge", -10, null);
    const { cycleId, productIds } = await onePerOrderCycle("late");
    const { paymentId, action } = await pendingPayment("late", member, cycleId, productIds[0], {
      chargeCents: 4000,
      balanceCents: 1000,
      walletCreditCents: 0,
    });
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    await applyOrderCredit(action, null);

    expect(await ledgerOf(member)).toEqual(["balance_payment 10.00 wallet", "order_payment 30.00 cycle"]);
    const refunds = await sql`SELECT refund_id, amount_cents, status FROM refunds WHERE payment_id = ${paymentId}`;
    expect(refunds.map((r) => `${r.refund_id} ${r.amount_cents} ${r.status}`)).toEqual([`late_${paymentId} 3000 requested`]);
    expect(await getConsolidatedBalanceCents(db(), member)).toBe(0);
    expect(await breaks()).toEqual([]);
  });

  it("never plans a card refund of the debt part at the settlement", async () => {
    const member = await scope.createExtraMember("settle");
    await scope.addLedger("settle_charge", member, "manual_charge", -10, null);
    const { cycleId, productIds } = await onePerOrderCycle("settle");
    const { paymentId, action } = await pendingPayment("settle", member, cycleId, productIds[0], {
      chargeCents: 4000,
      balanceCents: 1000,
      walletCreditCents: 0,
    });
    await applyOrderCredit(action, null);
    // The supplier had nothing: no charge, the whole cycle net goes back.
    await sql`DELETE FROM orders WHERE member_id = ${member} AND cycle_id = ${cycleId}`;
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() WHERE cycle_id = ${cycleId}`;
    const preview = await previewSettlement(db(), cycleId);
    const plan = preview.members.find((m) => m.memberId === member)?.plan;
    expect(plan).toEqual({ kind: "refund", refunds: [{ paymentId, amountCents: 3000 }], excessCents: 0 });
  });
});

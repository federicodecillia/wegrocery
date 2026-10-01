import type Stripe from "stripe";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { balanceDueParts, getConsolidatedBalanceCents } from "./balance-due";
import { applyWebhookAction, planWebhookAction } from "./webhook";

// "Da saldare" on a real database: the consolidated balance leaves out the
// pay-per-order cycles still running or not settled, and paying it credits
// each cycle it covers.
describeDb("amount due in pay-per-order", () => {
  const scope = makeScope("due");
  const { sql } = scope;
  let settledA: string, settledB: string, running: string;

  beforeAll(async () => {
    await scope.createMember();
    ({ cycleId: settledA } = await scope.createCycle("a", { paymentMode: "per_order" }));
    ({ cycleId: settledB } = await scope.createCycle("b", { paymentMode: "per_order" }));
    ({ cycleId: running } = await scope.createCycle("r", { paymentMode: "per_order" }));
    // Two settled cycles where the costs beat the payments: 2.30 and 1.00 due.
    await scope.createPaidOrderPayment("a", settledA, 1000);
    await scope.addLedger("a_oc", scope.memberId, "order_charge", -12.3, settledA);
    await scope.createPaidOrderPayment("b", settledB, 500);
    await scope.addLedger("b_oc", scope.memberId, "order_charge", -6, settledB);
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() - interval '2 days', settled_at = now()
      WHERE cycle_id = ${settledA}`;
    await sql`UPDATE order_cycles SET status = 'closed', closed_at = now() - interval '1 day', settled_at = now()
      WHERE cycle_id = ${settledB}`;
    // A running cycle with money paid in: not part of the amount due.
    await scope.createPaidOrderPayment("r", running, 2000);
    // An old wallet debt outside any cycle.
    await scope.addLedger("old", scope.memberId, "manual_charge", -0.7, null);
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("counts settled cycles and debts outside cycles, not the running cycle", async () => {
    expect(await getConsolidatedBalanceCents(getDb(), scope.memberId)).toBe(-400);
  });

  it("splits a payment over the cycles that owe, oldest first, the rest outside cycles", async () => {
    expect(await balanceDueParts(getDb(), scope.memberId, 400)).toEqual([
      { cycleId: settledA, cents: 230 },
      { cycleId: settledB, cents: 100 },
      { cycleId: null, cents: 70 },
    ]);
  });

  it("credits each part when the payment lands, once", async () => {
    const paymentId = scope.id("bal");
    const parts = await balanceDueParts(getDb(), scope.memberId, 400);
    await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency, refunded_cents,
        checkout_session_id, created_at, updated_at, kind, order_snapshot)
      VALUES (${paymentId}, ${scope.memberId}, 'stripe', 'pending', 400, 'eur', 0, ${`cs_${paymentId}`}, now(), now(),
        'balance', ${JSON.stringify({ parts })}::jsonb)`;
    const event = {
      id: `evt_${paymentId}`,
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: `cs_${paymentId}`,
          metadata: { paymentId, memberId: scope.memberId, kind: "balance" },
          payment_status: "paid",
          amount_total: 400,
          currency: "eur",
          payment_intent: `pi_${paymentId}`,
        },
      },
    } as unknown as Stripe.Event;
    await applyWebhookAction(planWebhookAction(event));
    await applyWebhookAction(planWebhookAction(event));
    const rows = await sql`SELECT cycle_id, amount::text AS amount FROM ledger_entries
      WHERE payment_id = ${paymentId} ORDER BY amount DESC`;
    expect(rows.map((r) => `${r.cycle_id ?? "-"} ${r.amount}`)).toEqual([`${settledA} 2.30`, `${settledB} 1.00`, "- 0.70"]);
    expect(await getConsolidatedBalanceCents(getDb(), scope.memberId)).toBe(0);
  });
});

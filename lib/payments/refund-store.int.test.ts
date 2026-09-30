import type Stripe from "stripe";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb, makeScope } from "@/test/int/fixtures";
import { applyWebhookAction, planWebhookAction } from "./webhook";

// The refund handling of the webhook against a real database: replays,
// concurrent and out-of-order events, a refund that fails after being paid,
// and a refund imported by migration 0020 that Stripe names again.
describeDb("stripe refunds on the database", () => {
  const scope = makeScope("refunds");
  const { sql } = scope;
  const start = new Date();
  let a: { paymentId: string; paymentIntentId: string };
  let b: { paymentId: string; paymentIntentId: string };
  let c: { paymentId: string; paymentIntentId: string };
  const re = (name: string) => `re_${scope.prefix}_${name}`;

  function refundEvent(type: string, id: string, paymentIntentId: string, amount: number, status: string): Stripe.Event {
    const object = {
      id,
      object: "refund",
      payment_intent: paymentIntentId,
      amount,
      currency: "eur",
      status,
      created: Math.floor(Date.now() / 1000),
      metadata: {},
    };
    return { id: `evt_${id}_${status}`, type, livemode: false, data: { object } } as unknown as Stripe.Event;
  }
  const send = (event: Stripe.Event) => applyWebhookAction(planWebhookAction(event));

  async function state(paymentId: string) {
    const [p] = await sql`SELECT status, refunded_cents FROM payments WHERE payment_id = ${paymentId}`;
    const refunds = await sql`SELECT stripe_refund_id, status, amount_cents FROM refunds
      WHERE payment_id = ${paymentId} ORDER BY created_at, refund_id`;
    const ledger = await sql`SELECT type, amount::text AS amount FROM ledger_entries
      WHERE payment_id = ${paymentId} AND type <> 'topup' ORDER BY created_at, entry_id`;
    return {
      payment: `${p.status} ${p.refunded_cents}`,
      refunds: refunds.map((r) => `${r.stripe_refund_id ?? "-"} ${r.status} ${r.amount_cents}`),
      ledger: ledger.map((l) => `${l.type} ${l.amount}`),
    };
  }

  beforeAll(async () => {
    await scope.createMember();
    a = await scope.createPaidTopup("a", 1000);
    b = await scope.createPaidTopup("b", 1000);
    c = await scope.createPaidTopup("c", 1000);
    // Payment c carries a refund recorded before 1.15.0 and imported by 0020:
    // Stripe has not named it yet. The imported row is dated after the Stripe
    // refund the events below carry (created "now"), as a real one would be.
    const legacyEntry = scope.id("led_c_refund");
    const legacyRefund = `ref_legacy_${legacyEntry}`;
    await sql`UPDATE payments SET refunded_cents = 500, status = 'partially_refunded' WHERE payment_id = ${c.paymentId}`;
    await sql`INSERT INTO refunds (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
        stripe_refund_id, created_by, created_at, updated_at)
      VALUES (${legacyRefund}, ${c.paymentId}, ${scope.memberId}, NULL, 500, 'succeeded', 'dashboard', NULL,
        'import', now() + interval '1 hour', now())`;
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by,
        created_at, payment_id, refund_id)
      VALUES (${legacyEntry}, ${scope.memberId}, now(), 'correction', -5, 'Online top-up refund', 'stripe', now(),
        ${c.paymentId}, ${legacyRefund})`;
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("records a partial refund once when its event is delivered twice", async () => {
    await send(refundEvent("refund.created", re("a1"), a.paymentIntentId, 400, "succeeded"));
    await send(refundEvent("refund.created", re("a1"), a.paymentIntentId, 400, "succeeded"));
    expect(await state(a.paymentId)).toEqual({
      payment: "partially_refunded 400",
      refunds: [`${re("a1")} succeeded 400`],
      ledger: ["correction -4.00"],
    });
  });

  it("posts one debit when pending and succeeded arrive together", async () => {
    await Promise.all([
      send(refundEvent("refund.created", re("a2"), a.paymentIntentId, 600, "pending")),
      send(refundEvent("refund.updated", re("a2"), a.paymentIntentId, 600, "succeeded")),
    ]);
    expect(await state(a.paymentId)).toEqual({
      payment: "refunded 1000",
      refunds: [`${re("a1")} succeeded 400`, `${re("a2")} succeeded 600`],
      ledger: ["correction -4.00", "correction -6.00"],
    });
  });

  it("reverses once a refund that fails after being paid", async () => {
    await send(refundEvent("refund.failed", re("a1"), a.paymentIntentId, 400, "failed"));
    await send(refundEvent("refund.failed", re("a1"), a.paymentIntentId, 400, "failed"));
    expect(await state(a.paymentId)).toEqual({
      payment: "partially_refunded 600",
      refunds: [`${re("a1")} failed 400`, `${re("a2")} succeeded 600`],
      ledger: ["correction -4.00", "correction -6.00", "refund_failed 4.00"],
    });
  });

  it("tells the member once and each admin once about the failed refund", async () => {
    const [{ n: admins }] = await sql`SELECT count(*)::int AS n FROM members WHERE active AND role = 'admin'`;
    const rows = await sql`SELECT (member_id = ${scope.memberId}) AS own, count(*)::int AS n FROM notifications
      WHERE type = 'refund_failed' AND created_at >= ${start}
        AND (member_id = ${scope.memberId} OR body LIKE ${`%${scope.memberName}%`})
      GROUP BY 1 ORDER BY 1`;
    expect(rows.map((r) => `${r.own} ${r.n}`)).toEqual(admins > 0 ? [`false ${admins}`, "true 1"] : ["true 1"]);
    const [{ n: refundNotes }] = await sql`SELECT count(*)::int AS n FROM notifications
      WHERE member_id = ${scope.memberId} AND type = 'topup_received'`;
    expect(refundNotes).toBe(2);
  });

  it("ignores a pending event that arrives after succeeded", async () => {
    await send(refundEvent("refund.updated", re("b1"), b.paymentIntentId, 1000, "succeeded"));
    await send(refundEvent("refund.created", re("b1"), b.paymentIntentId, 1000, "pending"));
    expect(await state(b.paymentId)).toEqual({
      payment: "refunded 1000",
      refunds: [`${re("b1")} succeeded 1000`],
      ledger: ["correction -10.00"],
    });
  });

  it("adopts an imported refund instead of posting it twice, and reverses it if it fails", async () => {
    await send(refundEvent("refund.updated", re("c1"), c.paymentIntentId, 500, "succeeded"));
    expect(await state(c.paymentId)).toEqual({
      payment: "partially_refunded 500",
      refunds: [`${re("c1")} succeeded 500`],
      ledger: ["correction -5.00"],
    });
    await send(refundEvent("refund.failed", re("c1"), c.paymentIntentId, 500, "failed"));
    expect(await state(c.paymentId)).toEqual({
      payment: "succeeded 0",
      refunds: [`${re("c1")} failed 500`],
      ledger: ["correction -5.00", "refund_failed 5.00"],
    });
  });

  it("keeps the balance and refunded_cents consistent", async () => {
    // 3 x 10 - 4 - 6 + 4 - 10 - 5 + 5
    const [{ balance }] = await sql`SELECT sum(amount)::text AS balance FROM ledger_entries
      WHERE member_id = ${scope.memberId}`;
    expect(balance).toBe("14.00");
    const drift = await sql`SELECT p.payment_id FROM payments p
      LEFT JOIN refunds r ON r.payment_id = p.payment_id AND r.status IN ('pending', 'succeeded')
      WHERE p.member_id = ${scope.memberId}
      GROUP BY p.payment_id, p.refunded_cents
      HAVING p.refunded_cents <> coalesce(sum(r.amount_cents), 0)`;
    expect(drift).toEqual([]);
  });
});

// Adoption of the refunds imported by migration 0020 (created_by = 'import',
// no Stripe id): only by a Stripe refund made before the import, and never
// the same row twice.
describeDb("adoption of imported refunds", () => {
  const scope = makeScope("adopt");
  const { sql } = scope;
  const re = (name: string) => `re_${scope.prefix}_${name}`;
  let pay: { paymentId: string; paymentIntentId: string };

  function refundUpdated(id: string, amount: number, createdSecondsAgo: number): Stripe.Event {
    const object = {
      id,
      object: "refund",
      payment_intent: pay.paymentIntentId,
      amount,
      currency: "eur",
      status: "succeeded",
      created: Math.floor(Date.now() / 1000) - createdSecondsAgo,
      metadata: {},
    };
    return { id: `evt_${id}`, type: "refund.updated", livemode: false, data: { object } } as unknown as Stripe.Event;
  }
  const send = (event: Stripe.Event) => applyWebhookAction(planWebhookAction(event));

  async function importRefund(name: string, amountCents: number) {
    const entryId = scope.id(`led_${name}`);
    const refundId = `ref_legacy_${entryId}`;
    await sql`INSERT INTO refunds (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
        stripe_refund_id, created_by, created_at, updated_at)
      VALUES (${refundId}, ${pay.paymentId}, ${scope.memberId}, NULL, ${amountCents}, 'succeeded', 'dashboard',
        NULL, 'import', now() - interval '1 hour', now())`;
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by,
        created_at, payment_id, refund_id)
      VALUES (${entryId}, ${scope.memberId}, now(), 'correction', ${-amountCents}::numeric / 100,
        'Online top-up refund', 'stripe', now(), ${pay.paymentId}, ${refundId})`;
    await sql`UPDATE payments SET refunded_cents = refunded_cents + ${amountCents}, status = 'partially_refunded'
      WHERE payment_id = ${pay.paymentId}`;
  }

  async function refundRows() {
    const rows = await sql`SELECT stripe_refund_id, created_by FROM refunds
      WHERE payment_id = ${pay.paymentId} ORDER BY stripe_refund_id NULLS LAST`;
    return rows.map((r) => `${r.stripe_refund_id ?? "-"} ${r.created_by}`);
  }

  beforeAll(async () => {
    await scope.createMember();
    pay = await scope.createPaidTopup("p", 5000);
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("does not adopt an imported row for a refund Stripe made after the import", async () => {
    await importRefund("old", 300); // imported an hour ago
    await send(refundUpdated(re("new"), 300, 60)); // made a minute ago: a second refund of the same amount
    expect(await refundRows()).toEqual([`${re("new")} stripe`, "- import"]);
    const [{ refunded_cents }] = await sql`SELECT refunded_cents FROM payments WHERE payment_id = ${pay.paymentId}`;
    expect(refunded_cents).toBe(600);
  });

  it("adopts two imported rows of the same amount once each under concurrent events", async () => {
    await importRefund("twin", 300); // now two unnamed imported rows of 300
    await Promise.all([
      send(refundUpdated(re("x"), 300, 7200)),
      send(refundUpdated(re("y"), 300, 7200)),
    ]);
    expect(await refundRows()).toEqual([`${re("new")} stripe`, `${re("x")} import`, `${re("y")} import`]);
    const [{ refunded_cents }] = await sql`SELECT refunded_cents FROM payments WHERE payment_id = ${pay.paymentId}`;
    expect(refunded_cents).toBe(900);
  });
});

// A refund made from the Stripe Dashboard on an order payment belongs to the
// payment's cycle, so what the cycle's payments cover goes down with it.
describeDb("dashboard refund of an order payment", () => {
  const scope = makeScope("dashord");
  const { sql } = scope;

  beforeAll(async () => {
    await scope.createMember();
  });

  afterAll(async () => {
    await scope.cleanup();
  });

  it("records it as an order_refund on the payment's cycle", async () => {
    const { cycleId } = await scope.createCycle("c", { paymentMode: "per_order" });
    const pay = await scope.createPaidOrderPayment("p", cycleId, 4000);
    const object = {
      id: `re_${scope.prefix}`,
      object: "refund",
      payment_intent: pay.paymentIntentId,
      amount: 4000,
      currency: "eur",
      status: "succeeded",
      created: Math.floor(Date.now() / 1000),
      metadata: {},
    };
    await applyWebhookAction(
      planWebhookAction({ id: "evt_x", type: "refund.created", livemode: false, data: { object } } as unknown as Stripe.Event),
    );
    const rows = await sql`SELECT type, amount::text AS amount, cycle_id FROM ledger_entries
      WHERE payment_id = ${pay.paymentId} ORDER BY created_at, entry_id`;
    expect(rows.map((r) => `${r.type} ${r.amount} ${r.cycle_id}`)).toEqual([
      `order_payment 40.00 ${cycleId}`,
      `order_refund -40.00 ${cycleId}`,
    ]);
    const [r] = await sql`SELECT cycle_id FROM refunds WHERE payment_id = ${pay.paymentId}`;
    expect(r.cycle_id).toBe(cycleId);
  });
});

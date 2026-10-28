// Staging check of the weighing deposit (drizzle/0045) with real Stripe
// sandbox payments: a fake card cycle (fee 0%, deposit 3%) with two fake
// members who pay their orders through a real Checkout Session, completed
// with Stripe's test card, so the deployed staging webhook books
// order_payment. Then the close, weighed actuals (A under estimate + deposit,
// B above it), the settlement (settleCycle, refunds on Stripe) and the
// checks. `cleanup` removes every fake row.
//
//   STAGING_DB_HOST=<host of the staging database> \
//   STAGING_APP_HOST=<host of the staging deploy> \
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/stripe-deposit-check.mts run|cleanup
//
// Safety as scripts/stripe-staging-check.mjs: exactly one Stripe TEST key,
// refuses any database whose host is not STAGING_DB_HOST, never prints a key
// or a connection string, never sends email.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { REQUIRED_STRIPE_EVENTS } from "../lib/payments/config";

let fromFile: Record<string, string | undefined> = {};
try {
  fromFile = parseEnv(readFileSync(join(process.cwd(), ".env.stripe-sandbox.local"), "utf8"));
} catch {}
const candidates = new Set(
  [...Object.values(fromFile), ...Object.values(process.env)]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.startsWith("sk_test_") || v.startsWith("rk_test_")),
);
if (candidates.size !== 1) throw new Error(`refusing: expected exactly one Stripe test key, found ${candidates.size}`);
const [key] = candidates;

const expectedDbHost = process.env.STAGING_DB_HOST?.trim();
const appHost = process.env.STAGING_APP_HOST?.trim();
if (!expectedDbHost || !appHost) throw new Error("refusing: set STAGING_DB_HOST and STAGING_APP_HOST");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
let host: string;
try {
  host = new URL(url).host;
} catch {
  throw new Error("refusing: DATABASE_URL is not a valid URL"); // never echo it
}
if (host !== expectedDbHost) throw new Error("refusing: DATABASE_URL is not the staging database");
// No email from here, whatever the env files hold.
delete process.env.RESEND_API_KEY;

const stripe = new Stripe(key);
const sql = neon(url);
const C = "stgdep_cycle";
const TITLE = "Stripe deposit check";
const P1 = "stgdep_p1"; // 10,00 €
const P2 = "stgdep_p2"; // 5,00 €
const MEMBERS = {
  a: { id: "stgdep_a", lines: [{ productId: P1, quantity: 2 }, { productId: P2, quantity: 2 }], p1Actual: "19.50" },
  b: { id: "stgdep_b", lines: [{ productId: P1, quantity: 1 }, { productId: P2, quantity: 2 }], p1Actual: "11.50" },
} as const;
const PRICES: Record<string, number> = { [P1]: 1000, [P2]: 500 };
const ids = Object.values(MEMBERS).map((m) => m.id);
// A fresh id per run: it is the Checkout's idempotency key.
const RUN = Date.now().toString(36);
const payId = (k: string) => `stgdep_pay_${k}_${RUN}`;

async function cleanup() {
  await sql`DELETE FROM notifications WHERE member_id = ANY(${ids}) OR body LIKE ${`%${TITLE}%`}`;
  await sql`DELETE FROM audit_log WHERE entity_id = ${C} OR entity_id LIKE 'stgdep\_pay\_%'`;
  await sql.transaction((tx) => [
    tx`SELECT set_config('wegrocery.ledger_maintenance', 'on', true)`,
    tx`DELETE FROM ledger_entries WHERE member_id = ANY(${ids})`,
  ]);
  await sql`DELETE FROM refunds WHERE member_id = ANY(${ids})`;
  await sql`DELETE FROM orders WHERE cycle_id = ${C}`;
  await sql`DELETE FROM order_drafts WHERE cycle_id = ${C}`;
  await sql`DELETE FROM payments WHERE member_id = ANY(${ids})`;
  await sql`DELETE FROM products WHERE cycle_id = ${C}`;
  await sql`DELETE FROM order_cycles WHERE cycle_id = ${C}`;
  await sql`DELETE FROM members WHERE member_id = ANY(${ids})`;
}

async function setup() {
  const { data } = await stripe.webhookEndpoints.list({ limit: 20 });
  const ok = data.some(
    (e) =>
      e.status === "enabled" &&
      new URL(e.url).host === appHost &&
      (e.enabled_events.includes("*") || REQUIRED_STRIPE_EVENTS.every((w) => e.enabled_events.includes(w))),
  );
  if (!ok) throw new Error("refusing: this sandbox has no enabled endpoint on STAGING_APP_HOST with every required event");
  await cleanup();
  for (const [k, m] of Object.entries(MEMBERS)) {
    await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
      VALUES (${m.id}, ${`${TITLE} ${k.toUpperCase()}`}, ${`stgdep-${k}@example.invalid`}, 'utenti', true, now(), now())`;
  }
  // access_level admin: the fake cycle stays out of the staging members' view.
  await sql`INSERT INTO order_cycles (cycle_id, title, status, access_level, order_open_at, order_close_at, created_at,
      created_by, payment_mode, handling_fee_type, handling_fee_value, shipping_mode, shipping_cost_per_member,
      weighing_deposit_pct)
    VALUES (${C}, ${TITLE}, 'open', 'admin', now(), now() + interval '1 day', now(), 'stripe-deposit-check',
      'per_order', 'percent', 0, 'fixed_per_member', 0, 3)`;
  await sql`INSERT INTO products (product_id, cycle_id, name, unit_price, unit, active)
    VALUES (${P1}, ${C}, 'Formaggio a peso (test)', 10.00, 'kg', true), (${P2}, ${C}, 'Mele (test)', 5.00, 'kg', true)`;
}

// The way startOrderPayment does it: amount from orderPaymentAmount, a pending
// payments row with the snapshot, a Checkout Session with the same metadata.
async function pay(k: keyof typeof MEMBERS) {
  const { orderPaymentAmount, checkoutLineItems } = await import("../lib/payments/order-payment");
  const m = MEMBERS[k];
  const lines = m.lines.map((l) => ({ ...l, unitPriceCents: PRICES[l.productId] }));
  const productsCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const amount = orderPaymentAmount({
    productsCents,
    shipping: { mode: "fixed_per_member", fixedCents: 0 },
    fee: { type: "percent", value: 0 },
    coveredCents: 0,
    depositPct: 3,
  });
  if (amount.outcome !== "pay") throw new Error(`unexpected outcome ${amount.outcome}`);
  const snapshot = { ...amount, lines };
  const paymentId = payId(k);
  await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, balance_cents, currency,
      refunded_cents, created_at, updated_at, kind, cycle_id, order_snapshot)
    VALUES (${paymentId}, ${m.id}, 'stripe', 'pending', ${amount.chargeCents}, 0, 'eur', 0, now(), now(), 'order',
      ${C}, ${JSON.stringify(snapshot)}::jsonb)`;
  const metadata = { paymentId, memberId: m.id, cycleId: C, kind: "order" };
  const items = checkoutLineItems(amount, {
    products: `Prodotti: ${TITLE}`,
    shipping: "Spedizione",
    fee: "Commissione",
    deposit: "Cauzione pesatura (3%)",
    supplement: "Integrazione",
    afterCredit: "Dopo il credito",
    balance: "Saldo",
  });
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: `stgdep-${k}@example.invalid`,
      client_reference_id: m.id,
      line_items: items.map((i) => ({
        quantity: 1,
        price_data: { currency: "eur", unit_amount: i.amountCents, product_data: { name: i.name } },
      })),
      metadata,
      payment_intent_data: { metadata, description: `${TITLE}` },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `https://${appHost}/ordine?esito=ok`,
      cancel_url: `https://${appHost}/ordine?esito=annullato`,
    },
    { idempotencyKey: paymentId },
  );
  await sql`UPDATE payments SET checkout_session_id = ${session.id} WHERE payment_id = ${paymentId}`;
  // Complete the hosted Checkout with Stripe's test card, as `stripe trigger
  // checkout.session.completed` does (payment_pages confirm, test mode only).
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" },
    billing_details: { name: `${TITLE} ${k.toUpperCase()}`, email: `stgdep-${k}@example.invalid` },
  });
  const res = await fetch(`https://api.stripe.com/v1/payment_pages/${session.id}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ payment_method: pm.id, expected_amount: String(amount.chargeCents) }),
  });
  if (!res.ok) throw new Error(`payment_pages confirm ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(k, "paid", JSON.stringify({ items, charge: amount.chargeCents, deposit: amount.depositCents }));
  return amount;
}

async function waitFor<T>(what: string, fn: () => Promise<T | null>, ms = 90_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error(`timeout waiting for ${what}`);
}

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

async function ledgerOf(memberId: string) {
  const rows = await sql`SELECT type, amount::text AS amount, created_by FROM ledger_entries
    WHERE member_id = ${memberId} ORDER BY created_at, entry_id`;
  return rows.map((r) => `${r.type} ${r.amount}`);
}

async function run() {
  await setup();
  const paid = { a: await pay("a"), b: await pay("b") };
  for (const k of ["a", "b"] as const) {
    await waitFor(`order_payment of ${k}`, async () => {
      const r = await sql`SELECT 1 FROM ledger_entries WHERE payment_id = ${payId(k)} AND type = 'order_payment'`;
      return r.length ? true : null;
    });
  }
  for (const k of ["a", "b"] as const) {
    const [p] = await sql`SELECT status, amount_cents, payment_intent_id FROM payments WHERE payment_id = ${payId(k)}`;
    const orders = await sql`SELECT product_id, quantity FROM orders WHERE cycle_id = ${C} AND member_id = ${MEMBERS[k].id}
      ORDER BY product_id`;
    const [led] = await sql`SELECT amount::text AS amount, created_by FROM ledger_entries
      WHERE payment_id = ${payId(k)} AND type = 'order_payment'`;
    check(`${k} webhook booked the payment`, { status: p.status, amount: p.amount_cents, pi: !!p.payment_intent_id, led },
      { status: "succeeded", amount: paid[k].chargeCents, pi: true, led: { amount: (paid[k].chargeCents / 100).toFixed(2), created_by: "stripe" } });
    check(`${k} order written from the snapshot`, orders.map((o) => `${o.product_id} ${o.quantity}`),
      MEMBERS[k].lines.map((l) => `${l.productId} ${l.quantity}`));
  }

  const { getDb } = await import("../lib/db/client");
  const { commitCycleClose } = await import("../lib/cycle-close-store");
  const { settleCycle, previewSettlement } = await import("../lib/payments/settlement-store");
  const db = getDb();
  await commitCycleClose(db, C, "stripe-deposit-check");

  // Weighed actuals on the cheese line, as adminUpdateOrderLineActuals writes
  // them: the actual total and a correction of (estimate - actual).
  for (const k of ["a", "b"] as const) {
    const m = MEMBERS[k];
    const [line] = await sql`UPDATE orders SET actual_line_total = ${m.p1Actual}, updated_at = now()
      WHERE cycle_id = ${C} AND member_id = ${m.id} AND product_id = ${P1}
      RETURNING line_total::numeric - ${m.p1Actual}::numeric AS delta`;
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at)
      VALUES (${`led_stgdep_${k}_w`}, ${m.id}, now(), 'correction', ${line.delta}, ${C},
        'Formaggio a peso (test): costo effettivo', 'stripe-deposit-check', now())`;
  }

  const preview = await previewSettlement(db, C);
  console.log("preview", JSON.stringify(preview.members.map((m) => ({ id: m.memberId, net: m.netCents, plan: m.plan }))));
  const result = await settleCycle(db, C, { by: "stripe-deposit-check", stripe });
  console.log("settle", JSON.stringify(result));

  // A: refund on Stripe, booked once the deployed webhook confirms it.
  const refundA = await waitFor("refund of a succeeded", async () => {
    const r = await sql`SELECT refund_id, status, amount_cents, stripe_refund_id FROM refunds WHERE member_id = ${MEMBERS.a.id}`;
    return r.length && r.every((x) => x.status === "succeeded") ? r : null;
  });
  const [pa] = await sql`SELECT payment_intent_id, refunded_cents, status FROM payments WHERE payment_id = ${payId("a")}`;
  const live = await stripe.refunds.list({ payment_intent: pa.payment_intent_id, limit: 10 });
  // Expected: A final 29,50 € (19,50 + 10,00) vs paid 30,90 → 1,40 back.
  // B final 21,50 € (11,50 + 10,00) vs paid 20,60 → 0,90 due.
  check("a settlement refund row", refundA.map((r) => `${r.refund_id} ${r.status} ${r.amount_cents} ${!!r.stripe_refund_id}`),
    [`settle_${payId("a")}_1 succeeded 140 true`]);
  check("a refund on Stripe", live.data.map((r) => `${r.amount} ${r.status} ${r.metadata?.refundId}`),
    [`140 succeeded settle_${payId("a")}_1`]);
  check("a payment refunded_cents", `${pa.status} ${pa.refunded_cents}`, "partially_refunded 140");
  check("a ledger", await ledgerOf(MEMBERS.a.id),
    ["order_payment 30.90", "order_charge -30.00", "correction 0.50", "order_refund -1.40"]);
  check("b ledger", await ledgerOf(MEMBERS.b.id),
    ["order_payment 20.60", "order_charge -20.00", "correction -1.50"]);
  const nets = await sql`SELECT member_id, sum(amount)::text AS net FROM ledger_entries
    WHERE cycle_id = ${C} GROUP BY member_id ORDER BY member_id`;
  check("cycle nets", nets.map((n) => `${n.member_id} ${n.net}`), ["stgdep_a 0.00", "stgdep_b -0.90"]);
  const after = await previewSettlement(db, C);
  check("plans after", after.members.map((m) => `${m.memberId} ${JSON.stringify(m.plan)}`),
    [`stgdep_a {"kind":"settled"}`, `stgdep_b {"kind":"due","dueCents":90}`]);
  const refundsB = await sql`SELECT count(*)::int AS n FROM refunds WHERE member_id = ${MEMBERS.b.id}`;
  check("b no refund, no write-off", { refunds: refundsB[0].n, writeOffs: result.writeOffs, due: result.due }, { refunds: 0, writeOffs: 0, due: 1 });
  const [{ settled }] = await sql`SELECT settled_at IS NOT NULL AS settled FROM order_cycles WHERE cycle_id = ${C}`;
  check("cycle settled_at set", settled, true);
  const dueN = await sql`SELECT body FROM notifications WHERE member_id = ${MEMBERS.b.id} AND type = 'settlement_due'`;
  console.log("b settlement_due notice:", dueN.map((n) => n.body).join(" | "));
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const mode = process.argv[2];
if (mode === "run") await run();
else if (mode === "cleanup") {
  await cleanup();
  console.log("cleaned");
} else throw new Error("usage: run | cleanup");

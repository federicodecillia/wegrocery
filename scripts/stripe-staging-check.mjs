// Staging check with real Stripe sandbox refunds: creates three test payments
// for a fake member, refunds them on Stripe (two partial refunds, one that
// stays pending, one that fails after being paid) and then reads what the
// deployed webhook wrote. The fake member and its rows are removed by
// `cleanup`.
//
//   STAGING_DB_HOST=<host of the staging database> \
//   STAGING_APP_HOST=<host of the staging deploy> \
//   node --env-file=.env.local scripts/stripe-staging-check.mjs endpoints|setup|check|cleanup
//
// Safety: it needs exactly one Stripe TEST key (in .env.stripe-sandbox.local
// or in the loaded env files), refuses any database whose host is not
// STAGING_DB_HOST, and never prints a key or a connection string.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { REQUIRED_STRIPE_EVENTS } from "../lib/payments/config.ts";

let fromFile = {};
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
let host;
try {
  host = new URL(url).host;
} catch {
  throw new Error("refusing: DATABASE_URL is not a valid URL"); // never echo it
}
if (host !== expectedDbHost) throw new Error("refusing: DATABASE_URL is not the staging database");

const stripe = new Stripe(key);
const sql = neon(url);
const M = "mem_stgcheck";
const NAME = "Stripe staging check";
const STATE = join(tmpdir(), "wegrocery-stripe-staging-check.json");
const CASES = {
  a: { pm: "pm_card_visa", refunds: [400, 600] },
  b: { pm: "pm_card_pendingRefund", refunds: [1000] },
  c: { pm: "pm_card_refundFail", refunds: [1000] },
};
const payId = (k) => `pay_stgcheck_${k}`;

async function cleanup() {
  await sql`DELETE FROM notifications WHERE member_id = ${M} OR body LIKE ${`%${NAME}%`}`;
  await sql`DELETE FROM audit_log WHERE entity_id = ANY(${Object.keys(CASES).map(payId)})`;
  await sql`DELETE FROM ledger_entries WHERE member_id = ${M}`;
  await sql`DELETE FROM refunds WHERE member_id = ${M}`;
  await sql`DELETE FROM payments WHERE member_id = ${M}`;
  await sql`DELETE FROM members WHERE member_id = ${M}`;
}

async function endpoints() {
  const { data } = await stripe.webhookEndpoints.list({ limit: 20 });
  const rows = data.map((e) => ({
    host: new URL(e.url).host,
    status: e.status,
    missing: e.enabled_events.includes("*") ? [] : REQUIRED_STRIPE_EVENTS.filter((w) => !e.enabled_events.includes(w)),
  }));
  console.log("endpoints:", JSON.stringify(rows));
  return rows;
}

async function setup() {
  const rows = await endpoints();
  if (!rows.some((r) => r.status === "enabled" && r.missing.length === 0 && r.host === appHost))
    throw new Error("refusing: this sandbox has no enabled endpoint on STAGING_APP_HOST with every required event");
  await cleanup();
  await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
    VALUES (${M}, ${NAME}, 'stripe-staging-check@example.invalid', 'utenti', true, now(), now())`;
  const state = {};
  for (const [k, c] of Object.entries(CASES)) {
    const pi = await stripe.paymentIntents.create({
      amount: 1000,
      currency: "eur",
      payment_method: c.pm,
      payment_method_types: ["card"],
      confirm: true,
      metadata: { paymentId: payId(k), test: "stripe-staging-check" },
    });
    await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency,
        refunded_cents, payment_intent_id, created_at, updated_at)
      VALUES (${payId(k)}, ${M}, 'stripe', 'succeeded', 1000, 'eur', 0, ${pi.id}, now(), now())`;
    await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by,
        created_at, payment_id)
      VALUES (${`led_stgcheck_${k}`}, ${M}, now(), 'topup', 10, 'Online top-up', 'stripe', now(), ${payId(k)})`;
    state[k] = { pi: pi.id, piStatus: pi.status, refunds: [] };
  }
  for (const [k, c] of Object.entries(CASES)) {
    for (const amount of c.refunds) {
      const r = await stripe.refunds.create({ payment_intent: state[k].pi, amount });
      state[k].refunds.push({ id: r.id, amount, status: r.status });
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
}

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

async function dbState(paymentId) {
  const [p] = await sql`SELECT status, refunded_cents FROM payments WHERE payment_id = ${paymentId}`;
  const refunds = await sql`SELECT stripe_refund_id, status, amount_cents FROM refunds
    WHERE payment_id = ${paymentId} ORDER BY created_at, refund_id`;
  const ledger = await sql`SELECT type, amount::text AS amount FROM ledger_entries
    WHERE payment_id = ${paymentId} AND type <> 'topup' ORDER BY created_at, entry_id`;
  return {
    payment: `${p.status} ${p.refunded_cents}`,
    refunds: refunds.map((r) => `${r.status} ${r.amount_cents}`),
    ledger: ledger.map((l) => `${l.type} ${l.amount}`),
  };
}

async function checkAll() {
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  for (const k of Object.keys(CASES)) {
    const live = await stripe.refunds.list({ payment_intent: state[k].pi, limit: 10 });
    console.log(k, "stripe:", live.data.map((r) => `${r.amount} ${r.status}`).join(", "));
  }
  check("a two partial refunds", await dbState(payId("a")), {
    payment: "refunded 1000",
    refunds: ["succeeded 400", "succeeded 600"],
    ledger: ["correction -4.00", "correction -6.00"],
  });
  check("b pending then succeeded", await dbState(payId("b")), {
    payment: "refunded 1000",
    refunds: ["succeeded 1000"],
    ledger: ["correction -10.00"],
  });
  check("c succeeded then failed", await dbState(payId("c")), {
    payment: "succeeded 0",
    refunds: ["failed 1000"],
    ledger: ["correction -10.00", "refund_failed 10.00"],
  });
  const [{ balance }] = await sql`SELECT sum(amount)::text AS balance FROM ledger_entries WHERE member_id = ${M}`;
  check("balance 30 - 4 - 6 - 10 - 10 + 10", balance, "10.00");
  const [{ n: admins }] = await sql`SELECT count(*)::int AS n FROM members WHERE active AND role = 'admin'`;
  const failed = await sql`SELECT (member_id = ${M}) AS own, count(*)::int AS n FROM notifications
    WHERE type = 'refund_failed' AND (member_id = ${M} OR body LIKE ${`%${NAME}%`}) GROUP BY 1 ORDER BY 1`;
  check("refund_failed: member once, each admin once", failed.map((r) => `${r.own} ${r.n}`), [`false ${admins}`, "true 1"]);
  const [{ n: debits }] = await sql`SELECT count(*)::int AS n FROM notifications
    WHERE member_id = ${M} AND type = 'topup_received'`;
  check("one refund notice per debit", debits, 4);
  const [{ n: stripeIds }] = await sql`SELECT count(DISTINCT stripe_refund_id)::int AS n FROM refunds WHERE member_id = ${M}`;
  check("every refund has its Stripe id", stripeIds, 4);
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const mode = process.argv[2];
if (mode === "setup") await setup();
else if (mode === "check") await checkAll();
else if (mode === "endpoints") await endpoints();
else if (mode === "cleanup") { await cleanup(); console.log("cleaned"); }
else throw new Error("usage: endpoints | setup | check | cleanup");

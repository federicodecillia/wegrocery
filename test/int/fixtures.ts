import { neon } from "@neondatabase/serverless";
import { describe } from "vitest";

// describe, or a skipped describe when no test database is configured
// (test/int/setup.ts).
export const describeDb = process.env.INT_TEST_DB_READY === "1" ? describe : describe.skip;

type Sql = ReturnType<typeof neon<false, false>>;
let client: Sql | null = null;

// Connects on first use, so a skipped suite never needs a database.
export const testSql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  client ??= neon(process.env.DATABASE_URL!);
  return client(strings, ...values);
}) as Sql;

// A whole SQL statement as text (a migration file's), no parameters.
export async function runSql(statement: string): Promise<void> {
  client ??= neon(process.env.DATABASE_URL!);
  await client.query(statement);
}

// Every row a test creates hangs off one fake member whose id starts with
// this run's prefix, so cleanup removes exactly what the test wrote, even on
// a database that holds other data.
export function makeScope(label: string) {
  const run = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const prefix = `int_${label}_${run}`;
  const memberId = `${prefix}_mem`;
  const memberName = `Int test ${label} ${run}`;
  const sql = testSql;

  return {
    prefix,
    memberId,
    memberName,
    sql,
    id: (name: string) => `${prefix}_${name}`,

    async createMember(): Promise<void> {
      await sql`INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
        VALUES (${memberId}, ${memberName}, ${`${prefix}@example.invalid`}, 'utenti', true, now(), now())`;
    },

    // A top-up already credited: the payment row and its ledger row.
    async createPaidTopup(name: string, amountCents: number): Promise<{ paymentId: string; paymentIntentId: string }> {
      const paymentId = `${prefix}_pay_${name}`;
      const paymentIntentId = `pi_${prefix}_${name}`;
      await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency,
          refunded_cents, checkout_session_id, payment_intent_id, created_at, updated_at)
        VALUES (${paymentId}, ${memberId}, 'stripe', 'succeeded', ${amountCents}, 'eur', 0,
          ${`cs_${prefix}_${name}`}, ${paymentIntentId}, now(), now())`;
      await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, note, created_by,
          created_at, payment_id)
        VALUES (${`${prefix}_led_${name}`}, ${memberId}, now(), 'topup', ${amountCents}::numeric / 100,
          'Online top-up', 'stripe', now(), ${paymentId})`;
      return { paymentId, paymentIntentId };
    },

    // An order payment already credited on a cycle: the payment row and its
    // order_payment ledger row.
    async createPaidOrderPayment(
      name: string,
      cycleId: string,
      amountCents: number,
    ): Promise<{ paymentId: string; paymentIntentId: string }> {
      const paymentId = `${prefix}_pay_${name}`;
      const paymentIntentId = `pi_${prefix}_${name}`;
      await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency,
          refunded_cents, checkout_session_id, payment_intent_id, created_at, updated_at, kind, cycle_id,
          order_snapshot)
        VALUES (${paymentId}, ${memberId}, 'stripe', 'succeeded', ${amountCents}, 'eur', 0,
          ${`cs_${prefix}_${name}`}, ${paymentIntentId}, now(), now(), 'order', ${cycleId},
          ${JSON.stringify({ lines: [] })}::jsonb)`;
      await sql`INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, note,
          created_by, created_at, payment_id)
        VALUES (${`${prefix}_led_${name}`}, ${memberId}, now(), 'order_payment', ${amountCents}::numeric / 100,
          ${cycleId}, 'Order payment', 'stripe', now(), ${paymentId})`;
      return { paymentId, paymentIntentId };
    },

    // An order payment whose Checkout is still open: what startOrderPayment
    // writes before sending the member to Stripe.
    async createPendingOrderPayment(
      name: string,
      cycleId: string,
      amountCents: number,
      lines: { productId: string; quantity: number; unitPriceCents: number }[],
    ): Promise<{ paymentId: string; sessionId: string; paymentIntentId: string }> {
      const paymentId = `${prefix}_pay_${name}`;
      const sessionId = `cs_${prefix}_${name}`;
      await sql`INSERT INTO payments (payment_id, member_id, provider, status, amount_cents, currency,
          refunded_cents, checkout_session_id, created_at, updated_at, kind, cycle_id, order_snapshot)
        VALUES (${paymentId}, ${memberId}, 'stripe', 'pending', ${amountCents}, 'eur', 0, ${sessionId}, now(),
          now(), 'order', ${cycleId}, ${JSON.stringify({ lines })}::jsonb)`;
      return { paymentId, sessionId, paymentIntentId: `pi_${prefix}_${name}` };
    },

    // A refund the app has asked for and Stripe has not answered yet.
    async createRequestedRefund(
      refundId: string,
      paymentId: string,
      cycleId: string,
      amountCents: number,
      reason: "order_cancelled" | "late_payment" | "settlement",
    ): Promise<void> {
      await sql`INSERT INTO refunds (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
          stripe_refund_id, created_by, created_at, updated_at)
        VALUES (${refundId}, ${paymentId}, ${memberId}, ${cycleId}, ${amountCents}, 'requested', ${reason}, NULL,
          'system', now(), now())`;
    },

    // An open cycle with its products, all under this run's prefix.
    async createCycle(
      name: string,
      opts: {
        paymentMode?: "wallet" | "per_order";
        fee?: { type: "percent" | "fixed"; value: number } | null;
        shippingCostPerMember?: number | null;
        products?: { name: string; unitPrice: number }[];
      } = {},
    ): Promise<{ cycleId: string; productIds: string[] }> {
      const cycleId = `${prefix}_cyc_${name}`;
      const mode = opts.paymentMode ?? "wallet";
      const fee = opts.fee === undefined ? (mode === "per_order" ? { type: "percent", value: 10 } : null) : opts.fee;
      await sql`INSERT INTO order_cycles (cycle_id, title, shipping_mode, shipping_cost_per_member, order_open_at,
          order_close_at, status, access_level, created_by, created_at, payment_mode, handling_fee_type,
          handling_fee_value)
        VALUES (${cycleId}, ${`${memberName} ${name}`}, 'fixed_per_member', ${opts.shippingCostPerMember ?? null},
          now(), now() + interval '1 day', 'open', 'admin', 'int-test', now(), ${mode}, ${fee?.type ?? null},
          ${fee?.value ?? null})`;
      const productIds: string[] = [];
      for (const [i, p] of (opts.products ?? []).entries()) {
        const productId = `${cycleId}_p${i}`;
        await sql`INSERT INTO products (product_id, cycle_id, name, unit_price, sort_order, active)
          VALUES (${productId}, ${cycleId}, ${p.name}, ${p.unitPrice}, ${i}, true)`;
        productIds.push(productId);
      }
      return { cycleId, productIds };
    },

    async cleanup(): Promise<void> {
      const like = `${prefix}%`;
      await sql`DELETE FROM notifications WHERE member_id = ${memberId} OR body LIKE ${`%${memberName}%`}`;
      await sql`DELETE FROM audit_log WHERE entity_id LIKE ${like}`;
      await sql`DELETE FROM ledger_entries WHERE member_id = ${memberId}`;
      await sql`DELETE FROM refunds WHERE member_id = ${memberId}`;
      await sql`DELETE FROM payments WHERE member_id = ${memberId}`;
      await sql`DELETE FROM order_drafts WHERE member_id = ${memberId}`;
      await sql`DELETE FROM orders WHERE member_id = ${memberId}`;
      await sql`DELETE FROM notification_preferences WHERE member_id = ${memberId}`;
      await sql`DELETE FROM members WHERE member_id = ${memberId}`;
      await sql`DELETE FROM order_drafts WHERE cycle_id LIKE ${like}`;
      await sql`DELETE FROM orders WHERE cycle_id LIKE ${like}`;
      await sql`DELETE FROM products WHERE cycle_id LIKE ${like}`;
      await sql`DELETE FROM order_cycles WHERE cycle_id LIKE ${like}`;
    },
  };
}

export type Scope = ReturnType<typeof makeScope>;

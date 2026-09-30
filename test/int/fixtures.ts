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
    },
  };
}

export type Scope = ReturnType<typeof makeScope>;

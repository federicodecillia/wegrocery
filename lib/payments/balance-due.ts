import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { audit, notifyMember, type Db } from "./effects";

// "Da saldare" in pay-per-order (spec, "Principio contabile" and "Da
// saldare"). The consolidated balance is the member's balance without the
// net of the per_order cycles still running or not settled, minus the
// refunds asked for and not yet registered. Below zero it is an amount due,
// above zero a credit the association gives back.

// A ledger row or refund that belongs to a per_order cycle not settled yet.
const unsettled = (cycleColumn: ReturnType<typeof sql.raw>) => sql`EXISTS (
  SELECT 1 FROM order_cycles c
  WHERE c.cycle_id = ${cycleColumn} AND c.payment_mode = 'per_order' AND c.settled_at IS NULL)`;

export async function getConsolidatedBalanceCents(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.execute<{ cents: number }>(sql`
    SELECT (
      coalesce((SELECT round(sum(l.amount) * 100) FROM ledger_entries l
                WHERE l.member_id = ${memberId} AND NOT ${unsettled(sql.raw("l.cycle_id"))}), 0)
      - coalesce((SELECT sum(r.amount_cents) FROM refunds r
                  WHERE r.member_id = ${memberId} AND r.status = 'requested'
                    AND NOT ${unsettled(sql.raw("r.cycle_id"))}), 0)
    )::integer AS cents`);
  return rows[0]?.cents ?? 0;
}

export type BalancePart = { cycleId: string | null; cents: number };

// How a payment of the amount due is booked: on the settled per_order cycles
// that still owe, oldest first, so each one goes back to zero; the rest
// (debts from wallet mode, Cassa charges) outside any cycle.
export async function balanceDueParts(db: Db, memberId: string, amountCents: number): Promise<BalancePart[]> {
  const { rows } = await db.execute<{ cycle_id: string; owed: number }>(sql`
    SELECT c.cycle_id, (-(
      coalesce((SELECT round(sum(l.amount) * 100) FROM ledger_entries l
                WHERE l.member_id = ${memberId} AND l.cycle_id = c.cycle_id), 0)
      - coalesce((SELECT sum(r.amount_cents) FROM refunds r
                  WHERE r.member_id = ${memberId} AND r.cycle_id = c.cycle_id AND r.status = 'requested'), 0)
    ))::integer AS owed
    FROM order_cycles c
    WHERE c.payment_mode = 'per_order' AND c.settled_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM ledger_entries l WHERE l.member_id = ${memberId} AND l.cycle_id = c.cycle_id)
    ORDER BY c.closed_at NULLS LAST, c.cycle_id`);
  const parts: BalancePart[] = [];
  let left = amountCents;
  for (const r of rows) {
    if (left <= 0) break;
    if (r.owed <= 0) continue;
    const cents = Math.min(left, r.owed);
    parts.push({ cycleId: r.cycle_id, cents });
    left -= cents;
  }
  if (left > 0) parts.push({ cycleId: null, cents: left });
  return parts;
}

// A paid Checkout Session of an amount due (payments.kind = 'balance').
export type BalanceCreditAction = {
  kind: "balance_credit";
  paymentId: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string | null;
};

// ONE statement: the guarded payment update and a balance_payment row per
// part of the snapshot. A replayed event finds the payment no longer pending
// and writes nothing.
export async function applyBalanceCredit(a: BalanceCreditAction): Promise<void> {
  const db = getDb();
  const { rows } = await db.execute<{ member_id: string }>(sql`
    WITH upd AS (
      UPDATE payments
      SET status = 'succeeded',
          checkout_session_id = ${a.sessionId},
          payment_intent_id = coalesce(${a.paymentIntentId}, payment_intent_id),
          updated_at = now()
      WHERE payment_id = ${a.paymentId}
        AND status = 'pending'
        AND kind = 'balance'
        AND (checkout_session_id IS NULL OR checkout_session_id = ${a.sessionId})
        AND amount_cents = ${a.amountCents}
        AND currency = ${a.currency}
      RETURNING payment_id, member_id, order_snapshot
    )
    INSERT INTO ledger_entries
      (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
    SELECT 'led_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), upd.member_id, now(),
           'balance_payment', p.cents::numeric / 100, p."cycleId", ${t.ledger.balancePayment}, 'stripe', now(),
           upd.payment_id
    FROM upd, jsonb_to_recordset(upd.order_snapshot->'parts') AS p("cycleId" text, cents integer)
    RETURNING member_id`);
  const memberId = rows[0]?.member_id;
  if (!memberId) {
    const { rows: existing } = await db.execute<{ status: string; amount_cents: number; currency: string }>(
      sql`SELECT status, amount_cents, currency FROM payments WHERE payment_id = ${a.paymentId}`,
    );
    if (existing[0]?.status === "pending") {
      reportError("stripe balance payment", new Error("paid session does not match its payment row"), {
        paymentId: a.paymentId,
      });
      await audit(db, "stripe_balance_mismatch", a.paymentId, { action: a, row: existing[0] });
    }
    return;
  }
  try {
    await audit(db, "stripe_balance_payment", a.paymentId, { amountCents: a.amountCents });
    const amount = formatMoney(a.amountCents / 100);
    await notifyMember(db, memberId, "balance_paid", t.notificationsServer.balancePaidTitle, () =>
      t.notificationsServer.balancePaidBody(amount),
    );
  } catch (e) {
    // The credit is committed: never answer 500 for a notice.
    reportError("stripe balance payment notices", e, { paymentId: a.paymentId });
  }
}

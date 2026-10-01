import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { audit, notifyMember, type Db } from "./effects";
import { unsettledForMemberSql } from "./settlement-sql";

// "Da saldare" in pay-per-order (spec, "Principio contabile" and "Da
// saldare"). The consolidated balance is the member's balance without the
// net of the per_order cycles still running or not settled (for that member:
// settled but still owing money back to the card counts as not settled),
// minus the refunds asked for and not yet registered. Below zero it is an amount due,
// above zero a credit the association gives back.

export async function getConsolidatedBalanceCents(db: Db, memberId: string): Promise<number> {
  const unsettled = (cycleColumn: string) => unsettledForMemberSql(sql`${memberId}`, sql.raw(cycleColumn));
  const { rows } = await db.execute<{ cents: number }>(sql`
    SELECT (
      coalesce((SELECT round(sum(l.amount) * 100) FROM ledger_entries l
                WHERE l.member_id = ${memberId} AND NOT ${unsettled("l.cycle_id")}), 0)
      - coalesce((SELECT sum(r.amount_cents) FROM refunds r
                  WHERE r.member_id = ${memberId} AND r.status = 'requested'
                    AND NOT ${unsettled("r.cycle_id")}), 0)
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

// The split is worked out when the money lands, from the debts as they are
// then (a correction or a new settlement may have moved them since the
// Checkout opened). Then ONE statement: the guarded payment update and a
// balance_payment row per part. A row closed as failed or expired whose
// session was paid anyway is credited too (no order hangs on it); a replayed
// event finds the payment already credited and writes nothing.
export async function applyBalanceCredit(a: BalanceCreditAction): Promise<void> {
  const db = getDb();
  const { rows: found } = await db.execute<{ member_id: string }>(sql`
    SELECT member_id FROM payments WHERE payment_id = ${a.paymentId} AND kind = 'balance'`);
  const owner = found[0]?.member_id;
  const parts = owner ? await balanceDueParts(db, owner, a.amountCents) : [];
  const { rows } = await db.execute<{ member_id: string }>(sql`
    WITH upd AS (
      UPDATE payments
      SET status = 'succeeded',
          checkout_session_id = ${a.sessionId},
          payment_intent_id = coalesce(${a.paymentIntentId}, payment_intent_id),
          order_snapshot = ${JSON.stringify({ parts })}::jsonb,
          updated_at = now()
      WHERE payment_id = ${a.paymentId}
        AND status IN ('pending', 'failed', 'expired')
        AND kind = 'balance'
        AND (checkout_session_id IS NULL OR checkout_session_id = ${a.sessionId})
        AND amount_cents = ${a.amountCents}
        AND currency = ${a.currency}
        AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE payment_id = ${a.paymentId} AND type = 'balance_payment')
      RETURNING payment_id, member_id
    )
    INSERT INTO ledger_entries
      (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
    SELECT 'led_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), upd.member_id, now(),
           'balance_payment', p.cents::numeric / 100, p."cycleId", ${t.ledger.balancePayment}, 'stripe', now(),
           upd.payment_id
    FROM upd, jsonb_to_recordset(${JSON.stringify(parts)}::jsonb) AS p("cycleId" text, cents integer)
    RETURNING member_id`);
  const memberId = rows[0]?.member_id;
  if (!memberId) {
    const { rows: existing } = await db.execute<{ status: string; amount_cents: number; currency: string }>(
      sql`SELECT status, amount_cents, currency FROM payments WHERE payment_id = ${a.paymentId}`,
    );
    if (existing[0]?.status === "pending" || existing[0]?.status === "failed" || existing[0]?.status === "expired") {
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

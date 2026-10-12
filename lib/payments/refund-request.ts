import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { audit } from "./effects";
import { notifyAdminsOfRefund, upsertStripeRefund } from "./refund-store";
import { classifyRefundError, refundInputOf } from "./refunds";
import { getStripe } from "./stripe";

// Refunds the app starts itself (cancelled order, late payment; the
// settlement from B2.3). The caller first inserts a refunds row in status
// 'requested' inside its own guarded write; this sends it to Stripe.

// The one Stripe call this module makes, so tests can pass a fake.
export type RefundApi = { refunds: Pick<Stripe["refunds"], "create" | "list"> };

// sent: Stripe accepted it and the refund is in the ledger.
// failed: Stripe rejected the request; the row is 'failed', nothing moved.
// retry: Stripe could not be reached (or is off on this deploy); the row is
//   still 'requested' and a later call sends it again under the same
//   idempotency key, so the member can never be refunded twice.
// skipped: the row is not waiting any more (already sent, or unknown id).
export type RefundSendResult = "sent" | "failed" | "retry" | "skipped";

type RequestedRefund = {
  refund_id: string;
  payment_id: string;
  member_id: string;
  amount_cents: number;
  payment_intent_id: string | null;
  // Older than Stripe's 24 hours of idempotency: the same key no longer
  // protects a second call.
  stale: boolean;
};

// `stripe` left out: this deploy's client; an explicit null means none.
export async function sendRequestedRefund(refundId: string, stripeArg?: RefundApi | null): Promise<RefundSendResult> {
  const stripe = stripeArg === undefined ? await getStripe() : stripeArg;
  const db = getDb();
  const { rows } = await db.execute<RequestedRefund>(sql`
    SELECT r.refund_id, r.payment_id, r.member_id, r.amount_cents, p.payment_intent_id,
           r.created_at < now() - interval '23 hours' AS stale
    FROM refunds r
    JOIN payments p ON p.payment_id = r.payment_id
    WHERE r.refund_id = ${refundId} AND r.status = 'requested'
  `);
  const row = rows[0];
  if (!row) return "skipped";
  if (!stripe) return "retry";

  let refund: Stripe.Refund;
  try {
    if (row.stale && row.payment_intent_id) {
      // The first call may have reached Stripe with its answer lost: find it
      // by its id before asking again, or the member could be refunded twice.
      const { data } = await stripe.refunds.list({ payment_intent: row.payment_intent_id, limit: 100 });
      const earlier = data.find((r) => r.metadata?.refundId === refundId);
      if (earlier) {
        const input = refundInputOf(earlier);
        if (input) {
          await upsertStripeRefund(input);
          return "sent";
        }
      }
    }
    if (!row.payment_intent_id) throw Object.assign(new Error("payment without a payment intent"), { type: "StripeInvalidRequestError" });
    refund = await stripe.refunds.create(
      { payment_intent: row.payment_intent_id, amount: row.amount_cents, metadata: { refundId } },
      { idempotencyKey: refundId },
    );
  } catch (e) {
    if (classifyRefundError(e) === "retry") {
      reportError("stripe refund request", e, { refundId, paymentId: row.payment_id });
      return "retry";
    }
    const { rows: closed } = await db.execute(sql`
      UPDATE refunds SET status = 'failed', updated_at = now()
      WHERE refund_id = ${refundId} AND status = 'requested'
      RETURNING refund_id
    `);
    if (closed.length === 0) return "skipped"; // a webhook recorded it meanwhile
    reportError("stripe refund rejected", e, { refundId, paymentId: row.payment_id });
    try {
      await audit(db, "stripe_refund_rejected", row.payment_id, { refundId, amountCents: row.amount_cents });
      const amount = formatMoney(row.amount_cents / 100);
      await notifyAdminsOfRefund(db, row.member_id, t.notificationsServer.refundRejectedTitle, (name) =>
        t.notificationsServer.refundRejectedAdminBody(amount, name),
      );
    } catch (noticeError) {
      reportError("stripe refund notices", noticeError, { refundId });
    }
    return "failed";
  }

  const input = refundInputOf(refund);
  if (!input) {
    // Stripe answered without the payment intent or a status: leave the row
    // requested; the refund.* webhook will carry the full object.
    reportError("stripe refund request", new Error("refund response without payment intent"), { refundId });
    return "retry";
  }
  await upsertStripeRefund(input);
  return "sent";
}

// Every refund still waiting for Stripe, oldest first, within a time budget
// (a server action has minutes, not hours). Rows younger than two minutes are
// left alone: their first call may still be running.
export async function retryRequestedRefunds(
  stripeArg?: RefundApi | null,
  budgetMs = 240_000,
): Promise<{ sent: number; failed: number; waiting: number }> {
  const stripe = stripeArg === undefined ? await getStripe() : stripeArg;
  const started = Date.now();
  const db = getDb();
  const { rows } = await db.execute<{ refund_id: string }>(sql`
    SELECT refund_id FROM refunds
    WHERE status = 'requested' AND created_at < now() - interval '2 minutes'
    ORDER BY created_at, refund_id
  `);
  const outcome = { sent: 0, failed: 0, waiting: 0 };
  for (const { refund_id } of rows) {
    if (Date.now() - started > budgetMs) {
      outcome.waiting++;
      continue;
    }
    const result = await sendRequestedRefund(refund_id, stripe);
    if (result === "sent") outcome.sent++;
    else if (result === "failed") outcome.failed++;
    else if (result === "retry") outcome.waiting++;
  }
  return outcome;
}

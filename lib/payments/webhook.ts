import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { applyBalanceCredit, type BalanceCreditAction } from "./balance-due";
import { audit, genId, notifyMember } from "./effects";
import { applyOrderCredit, type OrderCreditAction } from "./order-credit";
import { syncChargeRefunds, upsertStripeRefund } from "./refund-store";
import { refundInputOf, type StripeRefundInput } from "./refunds";

// What a Stripe event means for us. Pure, so the event mapping is unit tested
// without a database.
export type WebhookAction =
  | {
      kind: "credit";
      paymentId: string;
      sessionId: string;
      amountCents: number;
      currency: string;
      paymentIntentId: string | null;
    }
  | OrderCreditAction
  | BalanceCreditAction
  | { kind: "close"; paymentId: string; sessionId: string; status: "failed" | "expired" }
  | { kind: "refund"; refund: StripeRefundInput }
  | { kind: "refund_sync"; paymentIntentId: string }
  | { kind: "ignore" };

function idOf(ref: string | { id: string } | null): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export function planWebhookAction(event: Stripe.Event): WebhookAction {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      // Sessions this app did not create (Dashboard, payment links) carry no
      // paymentId: nothing to credit. An unpaid "completed" session is a
      // delayed method (SEPA, bank transfer): the async event follows.
      if (!paymentId || session.payment_status !== "paid") return { kind: "ignore" };
      if (session.amount_total == null || !session.currency) return { kind: "ignore" };
      // An order payment (pay-per-order) becomes the member's order on its
      // cycle, a balance payment settles what the member owes; anything else
      // is a top-up.
      const cycleId = session.metadata?.cycleId;
      if (session.metadata?.kind === "order" && cycleId) {
        return {
          kind: "order_credit",
          paymentId,
          cycleId,
          sessionId: session.id,
          amountCents: session.amount_total,
          currency: session.currency,
          paymentIntentId: idOf(session.payment_intent),
        };
      }
      if (session.metadata?.kind === "balance") {
        return {
          kind: "balance_credit",
          paymentId,
          sessionId: session.id,
          amountCents: session.amount_total,
          currency: session.currency,
          paymentIntentId: idOf(session.payment_intent),
        };
      }
      return {
        kind: "credit",
        paymentId,
        sessionId: session.id,
        amountCents: session.amount_total,
        currency: session.currency,
        paymentIntentId: idOf(session.payment_intent),
      };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      if (!paymentId) return { kind: "ignore" };
      return {
        kind: "close",
        paymentId,
        sessionId: session.id,
        status: event.type === "checkout.session.expired" ? "expired" : "failed",
      };
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const refund = refundInputOf(event.data.object);
      return refund ? { kind: "refund", refund } : { kind: "ignore" };
    }
    case "charge.refunded": {
      // The event says how much was refunded in total, not which refund
      // changed: read the charge's refunds again (the safety net for refund.*
      // events that never arrived).
      const paymentIntentId = idOf(event.data.object.payment_intent);
      if (!paymentIntentId) return { kind: "ignore" };
      return { kind: "refund_sync", paymentIntentId };
    }
    default:
      return { kind: "ignore" };
  }
}

type LedgerRow = { member_id: string; amount: string; payment_id: string };

// Credit and close are ONE SQL statement each, hence one transaction: the
// guarded UPDATE on payments and the ledger INSERT happen together or not at
// all. A replayed or late event finds the payment already past the guarded
// status and writes nothing (and the partial unique index on
// ledger_entries.payment_id would reject a second credit anyway). Refunds go
// through upsertStripeRefund (lib/payments/refund-store.ts), same rules.
export async function applyWebhookAction(action: WebhookAction): Promise<void> {
  if (action.kind === "ignore") return;
  if (action.kind === "refund") return upsertStripeRefund(action.refund);
  if (action.kind === "refund_sync") return syncChargeRefunds(action.paymentIntentId);
  if (action.kind === "order_credit") return applyOrderCredit(action);
  if (action.kind === "balance_credit") return applyBalanceCredit(action);
  const db = getDb();

  if (action.kind === "credit") {
    const entryId = genId("led");
    const { rows } = await db.execute<LedgerRow>(sql`
      WITH upd AS (
        UPDATE payments
        SET status = 'succeeded',
            checkout_session_id = ${action.sessionId},
            payment_intent_id = coalesce(${action.paymentIntentId}, payment_intent_id),
            updated_at = now()
        WHERE payment_id = ${action.paymentId}
          AND status = 'pending'
          AND kind = 'topup'
          AND (checkout_session_id IS NULL OR checkout_session_id = ${action.sessionId})
          AND amount_cents = ${action.amountCents}
          AND currency = ${action.currency}
        RETURNING payment_id, member_id, amount_cents
      )
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
      SELECT ${entryId}, member_id, now(), 'topup', amount_cents::numeric / 100, NULL,
             ${t.topup.ledgerNote}, 'stripe', now(), payment_id
      FROM upd
      RETURNING member_id, amount::text AS amount, payment_id
    `);
    const credited = rows[0];
    if (!credited) {
      // Already credited (replay), or the event does not match what we asked
      // Stripe to charge. Only the second one needs a human.
      const { rows: existing } = await db.execute<{ status: string; amount_cents: number; currency: string }>(
        sql`SELECT status, amount_cents, currency FROM payments WHERE payment_id = ${action.paymentId}`,
      );
      if (existing[0]?.status === "pending") {
        console.error("[stripe] paid session does not match its payment row", { action, row: existing[0] });
        await audit(db, "stripe_topup_mismatch", action.paymentId, { action, row: existing[0] });
      }
      return;
    }
    await audit(db, "stripe_topup", action.paymentId, credited);
    const amount = formatMoney(parseFloat(credited.amount));
    await notifyMember(db, credited.member_id, "topup_received", t.notificationsServer.onlineTopupTitle, (balance) =>
      t.notificationsServer.onlineTopupBody(amount, balance),
    );
    return;
  }

  await db.execute(sql`
    UPDATE payments
    SET status = ${action.status}, checkout_session_id = ${action.sessionId}, updated_at = now()
    WHERE payment_id = ${action.paymentId} AND status = 'pending'
  `);
}

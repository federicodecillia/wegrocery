"use server";

import { and, eq, sql } from "drizzle-orm";
import { actionErrorMessage } from "@/lib/action-error";
import { requireActiveMember } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { getMemberById } from "@/lib/db/queries";
import { payments } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/observability";
import { balanceDueParts, getConsolidatedBalanceCents } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { expireOpenCheckouts } from "@/lib/payments/order-checkout";
import { SETTLEMENT_MIN_DUE_CENTS } from "@/lib/payments/settlement";
import { getStripe } from "@/lib/payments/stripe";
import { requestOrigin } from "@/lib/request-origin";

// "Paga ora" on an amount due (pay-per-order). The amount and its split per
// cycle always come from the database, never from the page.
export type BalancePaymentResult = { status: "redirect"; url: string } | { status: "error"; error: string };

const refuse = (error: string): BalancePaymentResult => ({ status: "error", error });

export async function startBalancePayment(): Promise<BalancePaymentResult> {
  try {
    const { memberId } = await requireActiveMember();
    const [member, settings] = await Promise.all([getMemberById(memberId), getPaymentSettings()]);
    if (!member || settings.mode !== "per_order" || member.paysOffline) return refuse(t.balance.nothingToPay);
    const stripe = settings.onlineTopupAvailable ? getStripe() : null;
    if (!stripe) return refuse(t.order.pay.unavailable);

    const db = getDb();
    if ((await expireOpenCheckouts(db, stripe, memberId, null, "balance")) === "paid") {
      return refuse(t.balance.inProgress);
    }
    const dueCents = -(await getConsolidatedBalanceCents(db, memberId));
    if (dueCents < SETTLEMENT_MIN_DUE_CENTS) return refuse(t.balance.nothingToPay);
    const parts = await balanceDueParts(db, memberId, dueCents);

    const now = new Date();
    const paymentId = `pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const currency = brand.currency.toLowerCase();
    await db.insert(payments).values({
      paymentId,
      memberId,
      provider: "stripe",
      status: "pending",
      amountCents: dueCents,
      currency,
      createdAt: now,
      updatedAt: now,
      kind: "balance",
      // The split the webhook books (lib/payments/balance-due.ts), not an
      // order's snapshot: written as plain JSON.
      orderSnapshot: sql`${JSON.stringify({ parts })}::jsonb`,
    });

    try {
      const origin = await requestOrigin();
      const metadata = { paymentId, memberId, kind: "balance" };
      const name = t.balance.lineItem(brand.orgName);
      const checkout = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          submit_type: "pay",
          locale: brand.locale,
          customer_email: member.email,
          client_reference_id: memberId,
          line_items: [{ quantity: 1, price_data: { currency, unit_amount: dueCents, product_data: { name } } }],
          metadata,
          payment_intent_data: { metadata, description: name },
          // Same short life as a top-up's session (Stripe's minimum is 30 min).
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          success_url: `${origin}/ricarica?esito=ok&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/ricarica?esito=annullato`,
        },
        { idempotencyKey: paymentId },
      );
      // Only while the row is still pending, as for order payments.
      const linked = await db
        .update(payments)
        .set({ checkoutSessionId: checkout.id, updatedAt: new Date() })
        .where(and(eq(payments.paymentId, paymentId), eq(payments.status, "pending")))
        .returning({ paymentId: payments.paymentId });
      if (linked.length === 0) {
        await stripe.checkout.sessions.expire(checkout.id).catch((e) => reportError("balance checkout", e, { paymentId }));
        return refuse(t.order.pay.changed);
      }
      if (!checkout.url) throw new Error("Checkout Session without url");
      return { status: "redirect", url: checkout.url };
    } catch (e) {
      reportError("balance checkout", e, { paymentId });
      await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.paymentId, paymentId));
      return refuse(t.topup.startFailed);
    }
  } catch (e) {
    return refuse(actionErrorMessage(e, t.errors.genericError, "startBalancePayment"));
  }
}

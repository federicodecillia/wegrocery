"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { getMemberById } from "@/lib/db/queries";
import { getWalletBalance } from "@/lib/payments/balance-due";
import { payments } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import {
  parseTopupAmount,
  topupCeilingCents,
  TOPUP_MAX_CENTS,
  TOPUP_MIN_CENTS,
  type TopupAmountError,
} from "@/lib/payments/config";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getStripe } from "@/lib/payments/stripe";
import { requestOrigin } from "@/lib/request-origin";

// Returned as a value, not thrown: in production Next.js hides thrown Server
// Action messages behind a digest.
export type StartTopupResult = { url: string } | { error: string };

function amountErrorMessage(code: TopupAmountError): string {
  const range = t.topup.amountRange(formatMoney(TOPUP_MIN_CENTS / 100), formatMoney(TOPUP_MAX_CENTS / 100));
  return code === "invalid" ? t.topup.amountInvalid : range;
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function startOnlineTopup(amountInput: string): Promise<StartTopupResult> {
  const session = await auth();
  const memberId = session?.user?.memberId;
  if (!memberId) redirect("/login");

  // Switched off in Impostazioni, or no usable key on this deploy.
  const settings = await getPaymentSettings();
  // A pay-per-order group has no wallet to top up.
  const stripe = settings.onlineTopupAvailable && settings.mode === "wallet" ? getStripe() : null;
  if (!stripe) return { error: t.topup.unavailable };

  const member = await getMemberById(memberId);
  if (!member) return { error: t.errors.memberNotFound };
  if (!member.active) return { error: t.errors.accountInactive };

  const parsed = parseTopupAmount(amountInput);
  if ("error" in parsed) return { error: amountErrorMessage(parsed.error) };

  // The group's maximum balance: /ricarica only offers what fits, this is the
  // check. Read before the insert, so two checkouts opened together can
  // overshoot it (a soft limit, see topupCeilingCents).
  const balanceCents = Math.round((await getWalletBalance(getDb(), member.memberId, member.paysOffline)) * 100);
  const maxBalanceCents = settings.maxBalance === null ? null : Math.round(settings.maxBalance * 100);
  const ceiling = topupCeilingCents(balanceCents, maxBalanceCents);
  if (ceiling === null) return { error: t.topup.atMaximum };
  if (parsed.cents > ceiling) {
    return { error: t.topup.amountRange(formatMoney(TOPUP_MIN_CENTS / 100), formatMoney(ceiling / 100)) };
  }

  const db = getDb();
  const now = new Date();
  const paymentId = genId("pay");
  const currency = brand.currency.toLowerCase();
  await db.insert(payments).values({
    paymentId,
    memberId: member.memberId,
    provider: "stripe",
    status: "pending",
    amountCents: parsed.cents,
    currency,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const origin = await requestOrigin();
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        submit_type: "pay",
        locale: brand.locale,
        customer_email: member.email,
        client_reference_id: member.memberId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: parsed.cents,
              product_data: { name: t.topup.lineItemName(brand.orgName) },
            },
          },
        ],
        metadata: { paymentId, memberId: member.memberId },
        payment_intent_data: {
          metadata: { paymentId, memberId: member.memberId },
          description: t.topup.lineItemName(brand.orgName),
        },
        // Short-lived: an abandoned session expires and its row is closed by
        // the checkout.session.expired webhook. Stripe's minimum is 30 min
        // after creation, so leave a margin for the time spent getting here.
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        success_url: `${origin}/ricarica?esito=ok&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/ricarica?esito=annullato`,
      },
      { idempotencyKey: paymentId },
    );
    await db
      .update(payments)
      .set({ checkoutSessionId: checkout.id, updatedAt: new Date() })
      .where(eq(payments.paymentId, paymentId));
    if (!checkout.url) throw new Error("Checkout Session without url");
    return { url: checkout.url };
  } catch (e) {
    console.error("[stripe] could not start checkout", paymentId, e);
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.paymentId, paymentId));
    return { error: t.topup.startFailed };
  }
}

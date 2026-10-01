"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { requireActiveMember } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { getCycleProducts, getMemberById, getMemberPendingOrderTotals, getOpenCycles } from "@/lib/db/queries";
import { auditLog, orderDrafts, payments } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { membershipAllowsOrder } from "@/lib/membership/order-check";
import { raisesOrderTotal } from "@/lib/membership/policy";
import { isMembershipCheckEnabled } from "@/lib/membership/wallyfor";
import { reportError } from "@/lib/observability";
import { normalizeDraftLines } from "@/lib/order-draft";
import { getConsolidatedBalanceCents } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { expireOpenCheckouts } from "@/lib/payments/order-checkout";
import { cancelOrderWrite, confirmOrderWithoutPayment, getCycleCoverageCents } from "@/lib/payments/order-confirm";
import {
  checkoutLineItems,
  cycleHandlingFee,
  ORDER_PAYMENT_MAX_CENTS,
  orderPaymentAmount,
  type OrderSnapshot,
} from "@/lib/payments/order-payment";
import { sendRequestedRefund } from "@/lib/payments/refund-request";
import { SETTLEMENT_MIN_DUE_CENTS } from "@/lib/payments/settlement";
import { getStripe } from "@/lib/payments/stripe";
import { requestOrigin } from "@/lib/request-origin";
import { canAccessCycle } from "@/lib/roles";

// Pay-per-order (payment mode 'per_order'): the member confirms the order by
// paying it. Refusals come back as values, like saveOrder's.

export type OrderPaymentErrorCode =
  | "invalid_quantity"
  | "cycle_not_open"
  | "product_not_found"
  | "membership_inactive"
  | "unavailable"
  | "in_progress"
  | "too_high"
  | "changed"
  | "balance_due"
  | "unexpected";

export type OrderPaymentResult =
  | { status: "confirmed" }
  | { status: "cancelled"; refunded: boolean }
  | { status: "redirect"; url: string }
  | { status: "error"; error: string; code: OrderPaymentErrorCode };

const refuse = (code: OrderPaymentErrorCode, error: string): OrderPaymentResult => ({ status: "error", error, code });

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

const cents = (euros: string | number) => Math.round(Number(euros) * 100);

export async function startOrderPayment(
  cycleId: string,
  lines: { productId: string; quantity: number }[],
): Promise<OrderPaymentResult> {
  try {
    const { memberId, email } = await requireActiveMember();
    const normalized = normalizeDraftLines(lines);
    if (!normalized) return refuse("invalid_quantity", t.errors.invalidQuantity);
    if (normalized.length === 0) return await cancelOrderOf(memberId, email, cycleId);

    const [member, cycles, settings] = await Promise.all([getMemberById(memberId), getOpenCycles(), getPaymentSettings()]);
    const cycle = cycles.find((c) => c.cycleId === cycleId);
    if (!member || !cycle || !canAccessCycle(cycle.accessLevel, member.role)) {
      return refuse("cycle_not_open", t.errors.cycleNotOpen);
    }
    const fee = cycleHandlingFee(cycle);
    // A member who pays outside the app confirms with saveOrder instead.
    if (cycle.paymentMode !== "per_order" || settings.mode !== "per_order" || !fee || member.paysOffline) {
      return refuse("cycle_not_open", t.errors.cycleNotOpen);
    }

    // Amounts always from the database: current prices, the cycle's shipping
    // and fee, and what the member's payments for this cycle already cover.
    const db = getDb();
    const now = new Date();
    const productMap = new Map((await getCycleProducts(cycleId)).map((p) => [p.productId, p]));
    const unknown = normalized.find((l) => !productMap.has(l.productId));
    if (unknown) return refuse("product_not_found", t.errors.productNotFound(unknown.productId));
    const priced = normalized.map((l) => ({ ...l, unitPrice: productMap.get(l.productId)!.unitPrice }));
    const productsCents = priced.reduce((sum, l) => sum + cents(l.unitPrice) * l.quantity, 0);

    const pending = await getMemberPendingOrderTotals(memberId, cycleId);
    const checkEnabled = isMembershipCheckEnabled() && member.role !== "admin";
    const raises = raisesOrderTotal(pending.thisCycle, productsCents / 100);
    if (!(await membershipAllowsOrder(member, checkEnabled, now, raises, "startOrderPayment"))) {
      return refuse("membership_inactive", t.errors.membershipInactive(brand.membershipUrl));
    }

    // Open Checkouts first, then the coverage: a payment landing meanwhile is
    // counted, and a Checkout left open cannot later overwrite this order.
    const stripe = settings.onlineTopupAvailable ? getStripe() : null;
    if (stripe && (await expireOpenCheckouts(db, stripe, memberId, cycleId)) === "paid") {
      return refuse("in_progress", t.order.pay.inProgress);
    }
    const covered = await getCycleCoverageCents(db, memberId, cycleId);
    const amount = orderPaymentAmount({
      productsCents,
      shipping: {
        mode: cycle.shippingMode,
        fixedCents: cycle.shippingCostPerMember === null ? null : cents(cycle.shippingCostPerMember),
      },
      fee,
      coveredCents: covered,
    });

    if (amount.outcome === "too_high") {
      return refuse("too_high", t.order.pay.tooHigh(formatMoney(ORDER_PAYMENT_MAX_CENTS / 100)));
    }

    if (amount.outcome === "confirm") {
      const written = await confirmOrderWithoutPayment(db, {
        memberId,
        cycleId,
        lines: priced,
        expectedCoveredCents: covered,
      });
      if (written === "changed") return refuse("changed", t.order.pay.changed);
      await writeAudit(email, "confirmMyOrder", cycleId, { lineCount: priced.length, amount });
      revalidateOrderPages();
      return { status: "confirmed" };
    }

    // Something to pay: Stripe Checkout, unless an amount due from earlier
    // cycles is still open (the draft can still change, reduce or cancel).
    if (!stripe) return refuse("unavailable", t.order.pay.unavailable);
    const dueCents = -(await getConsolidatedBalanceCents(db, memberId));
    if (dueCents >= SETTLEMENT_MIN_DUE_CENTS) {
      return refuse("balance_due", t.order.pay.balanceDue(formatMoney(dueCents / 100)));
    }

    // The draft is what the member will find if they come back without paying.
    await db
      .insert(orderDrafts)
      .values({ memberId, cycleId, lines: normalized, updatedAt: now })
      .onConflictDoUpdate({ target: [orderDrafts.memberId, orderDrafts.cycleId], set: { lines: normalized, updatedAt: now } });

    const snapshot: OrderSnapshot = {
      ...amount,
      lines: priced.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceCents: cents(l.unitPrice) })),
    };
    const paymentId = genId("pay");
    const currency = brand.currency.toLowerCase();
    await db.insert(payments).values({
      paymentId,
      memberId,
      provider: "stripe",
      status: "pending",
      amountCents: amount.chargeCents,
      currency,
      createdAt: now,
      updatedAt: now,
      kind: "order",
      cycleId,
      orderSnapshot: snapshot,
    });

    try {
      const origin = await requestOrigin();
      const metadata = { paymentId, memberId, cycleId, kind: "order" };
      const back = `${origin}/ordine?cycleId=${encodeURIComponent(cycleId)}`;
      const checkout = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          submit_type: "pay",
          locale: brand.locale,
          customer_email: member.email,
          client_reference_id: memberId,
          line_items: checkoutLineItems(amount, {
            products: t.order.pay.lineProducts(cycle.title),
            shipping: t.order.pay.shipping,
            fee: t.order.pay.fee,
            supplement: t.order.pay.supplement(cycle.title),
          }).map((item) => ({
            quantity: 1,
            price_data: { currency, unit_amount: item.amountCents, product_data: { name: item.name } },
          })),
          metadata,
          payment_intent_data: { metadata, description: `${brand.orgName}: ${cycle.title}` },
          // Same short life as a top-up's session (Stripe's minimum is 30 min).
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          success_url: `${back}&esito=ok&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${back}&esito=annullato`,
        },
        { idempotencyKey: paymentId },
      );
      // Only while the row is still pending: another tab may have closed it
      // meanwhile, and then this Checkout must not be paid.
      const linked = await db
        .update(payments)
        .set({ checkoutSessionId: checkout.id, updatedAt: new Date() })
        .where(and(eq(payments.paymentId, paymentId), eq(payments.status, "pending")))
        .returning({ paymentId: payments.paymentId });
      if (linked.length === 0) {
        await stripe.checkout.sessions.expire(checkout.id).catch((e) => reportError("order checkout", e, { paymentId }));
        return refuse("changed", t.order.pay.changed);
      }
      if (!checkout.url) throw new Error("Checkout Session without url");
      return { status: "redirect", url: checkout.url };
    } catch (e) {
      reportError("order checkout", e, { paymentId });
      await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.paymentId, paymentId));
      return refuse("unavailable", t.topup.startFailed);
    }
  } catch (e) {
    return refuse("unexpected", actionErrorMessage(e, t.errors.genericError, "startOrderPayment"));
  }
}

export async function cancelOrder(cycleId: string): Promise<OrderPaymentResult> {
  try {
    const { memberId, email } = await requireActiveMember();
    return await cancelOrderOf(memberId, email, cycleId);
  } catch (e) {
    return refuse("unexpected", actionErrorMessage(e, t.errors.genericError, "cancelOrder"));
  }
}

async function cancelOrderOf(memberId: string, email: string, cycleId: string): Promise<OrderPaymentResult> {
  const db = getDb();
  // An open Checkout would bring the order back if it were paid after the
  // cancel: expire it first. One already paid lands in the settlement.
  const stripe = getStripe();
  if (stripe && (await expireOpenCheckouts(db, stripe, memberId, cycleId)) === "paid") {
    return refuse("in_progress", t.order.pay.inProgress);
  }
  const written = await cancelOrderWrite(db, memberId, cycleId);
  if (written.status === "cycle_not_open") return refuse("cycle_not_open", t.errors.cycleNotOpen);
  await writeAudit(email, "cancelMyOrder", cycleId, { refunds: written.refundIds });
  for (const refundId of written.refundIds) {
    try {
      // "retry" leaves the refund requested: Cassa shows it to the admins.
      await sendRequestedRefund(refundId, stripe);
    } catch (e) {
      reportError("order cancel refund", e, { refundId });
    }
  }
  revalidateOrderPages();
  return { status: "cancelled", refunded: written.refundIds.length > 0 };
}

async function writeAudit(email: string, action: string, cycleId: string, payload: unknown): Promise<void> {
  await getDb().insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: email,
    action,
    entityType: "order",
    entityId: cycleId,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date(),
  });
}

function revalidateOrderPages(): void {
  revalidatePath("/");
  revalidatePath("/ordine");
  revalidatePath("/storico");
}

import { AppShell } from "@/components/app-shell";
import { OrderForm } from "./order-form";
import { CycleChooser } from "./cycle-chooser";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberOrderLines,
  getOpenCycles,
  getOrderDraft,
} from "@/lib/db/queries";
import { saveOrder } from "@/lib/actions/order";
import { cancelOrder, startOrderPayment } from "@/lib/actions/order-payment";
import { PendingRefresh } from "@/components/ricarica/pending-refresh";
import { getDb } from "@/lib/db/client";
import { getOrderPaymentStatus } from "@/lib/db/queries";
import { getCycleCoverageCents } from "@/lib/payments/order-confirm";
import type { HandlingFee } from "@/lib/payments/order-payment";
import { orderLinesKey, resumeDraft } from "@/lib/order-draft";
import { canAccessCycle } from "@/lib/roles";
import { resolveOrderCycle } from "@/lib/order-cycle";
import Link from "next/link";

export default async function OrdinePage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string; esito?: string; session_id?: string }>;
}) {
  const { cycleId: searchCycleId, esito, session_id: sessionId } = await searchParams;

  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, openCycles] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycles(),
  ]);

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));

  const choice = resolveOrderCycle(activeCycles, searchCycleId);
  if (choice.kind === "choose") {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
        <CycleChooser cycles={activeCycles} />
      </AppShell>
    );
  }
  const openCycle = choice.kind === "open" ? choice.cycle : null;

  if (!openCycle) {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">🛒</span>
          <h2 className="text-[18px] font-bold text-brand-near-black">{t.order.noOpenOrders}</h2>
          <p className="mt-2 text-[14px] text-brand-gray">
            {t.order.noOpenOrdersHint}
          </p>
        </div>
      </AppShell>
    );
  }

  const [cycleProducts, existingLines, storedDraft] = await Promise.all([
    getCycleProducts(openCycle!.cycleId),
    getMemberOrderLines(memberId, openCycle!.cycleId),
    getOrderDraft(memberId, openCycle!.cycleId),
  ]);
  // Unconfirmed edits to pick up, limited to the products still in the cycle.
  const resumedDraft = resumeDraft(
    storedDraft,
    existingLines,
    new Set(cycleProducts.map((p) => p.productId)),
  );

  // Pay-per-order cycle: the order is confirmed by paying it.
  const feeType = openCycle.handlingFeeType;
  const fee: HandlingFee | null =
    openCycle.paymentMode === "per_order" &&
    (feeType === "percent" || feeType === "fixed") &&
    openCycle.handlingFeeValue !== null
      ? { type: feeType, value: Number(openCycle.handlingFeeValue) }
      : null;
  const [coveredCents, payment] = fee
    ? await Promise.all([
        getCycleCoverageCents(getDb(), memberId, openCycle.cycleId),
        getOrderPaymentStatus(memberId, openCycle.cycleId, esito === "ok" ? sessionId : undefined),
      ])
    : [0, null];
  // What the way back from Stripe says; the payment row is the truth (only
  // the signed webhook moves it), never the redirect.
  const notice =
    !fee || !esito
      ? null
      : esito === "annullato"
        ? { tone: "info" as const, text: t.order.pay.payCancelled, pending: false }
        : payment === "pending"
          ? { tone: "info" as const, text: t.order.pay.verifying, pending: true }
          : payment === "succeeded"
            ? { tone: "ok" as const, text: t.order.pay.paid, pending: false }
            : payment === "failed"
              ? { tone: "error" as const, text: t.topup.resultFailed, pending: false }
              : null;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      {notice && (
        <div
          className={`mb-4 rounded-[14px] border p-[12px_14px] text-[14px] ${
            notice.tone === "ok"
              ? "border-accent bg-accent-soft text-brand-near-black"
              : notice.tone === "error"
                ? "border-brand-red/30 bg-brand-red-light text-brand-red"
                : "border-primary-mid bg-primary-soft text-brand-near-black"
          }`}
        >
          {notice.text}
          {notice.pending && <PendingRefresh />}
        </div>
      )}
      {activeCycles.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {activeCycles.map((c) => (
            <Link
              key={c.cycleId}
              href={`/ordine?cycleId=${c.cycleId}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors ${
                c.cycleId === openCycle!.cycleId
                  ? "bg-accent text-on-accent shadow-sm"
                  : "bg-white text-brand-gray border border-brand-border hover:bg-brand-warm-white"
              }`}
            >
              {c.title}
            </Link>
          ))}
        </div>
      )}
      <OrderForm
        // A new cycle is a new form: switching cycles must not carry over the
        // previous cycle's draft and saved quantities (client state survives
        // a search-param navigation).
        // On a pay-per-order cycle the confirmed order changes under the
        // page when the webhook lands: start again from what the server has.
        key={fee ? `${openCycle.cycleId}:${orderLinesKey(existingLines)}:${coveredCents}` : openCycle!.cycleId}
        cycleId={openCycle!.cycleId}
        cycleTitle={openCycle!.title}
        supplierName={openCycle!.supplierName}
        orderCloseAt={openCycle!.orderCloseAt?.toISOString() ?? null}
        products={cycleProducts.map((p) => ({
          productId: p.productId,
          name: p.name,
          variant: p.variant,
          format: p.format,
          unitPrice: p.unitPrice,
          pricePerKg: p.pricePerKg,
          unit: p.unit,
          category: p.category,
          sortOrder: p.sortOrder,
        }))}
        existingLines={existingLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        }))}
        resumedDraft={resumedDraft}
        balance={balance}
        saveAction={saveOrder}
        payPerOrder={
          fee
            ? {
                fee,
                shipping: {
                  mode: openCycle.shippingMode,
                  fixedCents:
                    openCycle.shippingCostPerMember === null
                      ? null
                      : Math.round(Number(openCycle.shippingCostPerMember) * 100),
                },
                coveredCents,
                payAction: startOrderPayment,
                cancelAction: cancelOrder,
              }
            : undefined
        }
      />
    </AppShell>
  );
}

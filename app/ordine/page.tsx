import { AppShell } from "@/components/app-shell";
import { OrderForm } from "./order-form";
import { CycleChooser } from "./cycle-chooser";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberById,
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
import { cycleHandlingFee, type HandlingFee } from "@/lib/payments/order-payment";
import { orderLinesKey, orderStateKey, resumeDraft } from "@/lib/order-draft";
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

  const [balance, openCycles, member] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycles(),
    getMemberById(memberId),
  ]);

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));

  const choice = resolveOrderCycle(activeCycles, searchCycleId);
  if (choice.kind === "choose") {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
        <CycleChooser cycles={activeCycles} />
      </AppShell>
    );
  }
  const openCycle = choice.kind === "open" ? choice.cycle : null;

  if (!openCycle) {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
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
  const availableProductIds = new Set(cycleProducts.map((p) => p.productId));
  const resumedDraft = resumeDraft(storedDraft, existingLines, availableProductIds);

  // Pay-per-order cycle: the order is confirmed by paying it, unless the
  // member pays outside the app (then the wallet form, as in wallet mode).
  const cycleFee = cycleHandlingFee(openCycle);
  const fee: HandlingFee | null =
    openCycle.paymentMode === "per_order" && !member?.paysOffline ? cycleFee : null;
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
            : payment === "refunded"
              ? { tone: "info" as const, text: t.order.pay.lateRefunded, pending: false }
            : payment === "failed"
              ? { tone: "error" as const, text: t.topup.resultFailed, pending: false }
              : null;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
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
        cycleNotes={openCycle.notes}
        products={cycleProducts.map((p) => ({
          productId: p.productId,
          name: p.name,
          variant: p.variant,
          format: p.format,
          unitPrice: p.unitPrice,
          pricePerKg: p.pricePerKg,
          notes: p.notes,
          unit: p.unit,
          category: p.category,
          sortOrder: p.sortOrder,
        }))}
        existingLines={existingLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        }))}
        resumedDraft={resumedDraft}
        serverStateKey={orderStateKey(storedDraft, existingLines, availableProductIds)}
        balance={balance}
        saveAction={saveOrder}
        // Card payers already see the fee in the Checkout summary; wallet (and
        // offline) members see it here as an estimate.
        walletFee={fee ? null : cycleFee}
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

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BalanceDueCard } from "@/components/balance/balance-due-card";
import { CycleCountdown } from "@/components/home/cycle-countdown";
import { NextPickupCard } from "@/components/home/next-pickup-card";
import { t } from "@/lib/i18n";
import { formatSignedMoney } from "@/lib/i18n/format";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberById,
  getMemberLedger,
  getMemberOrderLines,
  getNextMemberPickup,
  getOpenCycles,
  getOrderDraft,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { getConsolidatedBalanceCents } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getCycleCoverageCents } from "@/lib/payments/order-confirm";
import {
  cycleHandlingFee,
  handlingFeeCents,
  homeOrderStatus,
  orderPaymentAmount,
  type HomeOrderStatus,
} from "@/lib/payments/order-payment";
import { formatDateShort, formatEur, getProductEmoji } from "@/lib/utils";
import { canAccessCycle } from "@/lib/roles";
import { movementText } from "@/lib/movement-label";

export default async function HomePage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, openCycles, recentMovements, nextPickup, settings, member] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycles(),
    getMemberLedger(memberId, 4),
    getNextMemberPickup(memberId),
    getPaymentSettings(),
    getMemberById(memberId),
  ]);
  // A pay-per-order group has no wallet: no balance card, each cycle says
  // where its order stands, and the amount due or the credit comes first. A
  // member who pays outside the app keeps the wallet view.
  const payPerOrder = settings.mode === "per_order" && !member?.paysOffline;
  const consolidatedCents = payPerOrder ? await getConsolidatedBalanceCents(getDb(), memberId) : 0;

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));

  const cycleDataList = await Promise.all(
    activeCycles.map(async (cycle) => {
      const [cycleProducts, myLines] = await Promise.all([
        getCycleProducts(cycle.cycleId),
        getMemberOrderLines(memberId, cycle.cycleId),
      ]);
      const orderTotal = myLines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
      // The order preparation fee a wallet member will be charged at the close (estimate).
      const feeCents = payPerOrder ? 0 : handlingFeeCents(Math.round(orderTotal * 100), cycleHandlingFee(cycle));
      return { cycle, cycleProducts, myLines, orderTotal, feeCents, payStatus: await payStatusOf(cycle, cycleProducts, myLines.length > 0) };
    })
  );

  async function payStatusOf(
    cycle: (typeof activeCycles)[number],
    cycleProducts: { productId: string; unitPrice: string }[],
    hasConfirmedOrder: boolean,
  ): Promise<HomeOrderStatus> {
    const feeType = cycle.handlingFeeType;
    if (!payPerOrder || cycle.paymentMode !== "per_order" || (feeType !== "percent" && feeType !== "fixed") || cycle.handlingFeeValue === null) {
      return null;
    }
    const [coveredCents, draftLines] = await Promise.all([
      getCycleCoverageCents(getDb(), memberId, cycle.cycleId),
      getOrderDraft(memberId, cycle.cycleId),
    ]);
    const prices = new Map(cycleProducts.map((p) => [p.productId, Math.round(Number(p.unitPrice) * 100)]));
    const draft = draftLines
      ? orderPaymentAmount({
          productsCents: draftLines.reduce((sum, l) => sum + (prices.get(l.productId) ?? 0) * l.quantity, 0),
          shipping: {
            mode: cycle.shippingMode,
            fixedCents: cycle.shippingCostPerMember === null ? null : Math.round(Number(cycle.shippingCostPerMember) * 100),
          },
          fee: { type: feeType, value: Number(cycle.handlingFeeValue) },
          coveredCents,
        })
      : null;
    return homeOrderStatus({ hasConfirmedOrder, draft, coveredCents });
  }

  const globalOrderTotal = cycleDataList.reduce((sum, d) => sum + (isNaN(d.orderTotal) ? 0 : d.orderTotal + d.feeCents / 100), 0);
  const afterBalance = (balance || 0) - globalOrderTotal;

  const isNegative = balance < 0;
  const balanceText = formatSignedMoney(balance);

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      {/* ── Saldo hero card (wallet groups only) ── */}
      {!payPerOrder && (
        <>
      <div
        className={`mb-[14px] rounded-[20px] p-[20px_22px_22px] ${
          isNegative
            ? "border-[1.5px] border-brand-red/30 bg-brand-red-light"
            : "border-[1.5px] border-primary-mid bg-primary-soft"
        }`}
      >
        <div
          className={`mb-[10px] font-mono text-label font-semibold uppercase tracking-[0.13em] ${
            isNegative ? "text-brand-red" : "text-primary-text"
          }`}
        >
          {isNegative ? t.home.balanceToTopUp : t.home.balanceTitle}
        </div>
        {/* The explicit sign makes the amount longer: it shrinks to the card's
            width (at most 70px) so a three-digit balance still fits a 375px
            phone. 0.61em per character covers the widest format measured
            ("+€888.88" is 0.60; Italian "+888,88 €" is 0.55), and nowrap keeps
            the sign from ever dropping onto its own line. */}
        <div className="@container mb-[16px] flex items-baseline gap-[6px]">
          <span
            className={`whitespace-nowrap font-black leading-none tracking-[-0.045em] ${
              isNegative ? "text-brand-red" : "text-brand-near-black"
            }`}
            style={{ fontSize: `min(70px, calc(100cqi / ${(0.61 * balanceText.length).toFixed(2)}))` }}
          >
            {balanceText}
          </span>
        </div>
        <div
          className={`flex overflow-hidden rounded-[12px] ${
            isNegative ? "border border-brand-red/30" : "border border-primary-mid"
          }`}
        >
          <div className="flex-1 bg-white/60 p-[9px_13px]">
            <div className="mb-[3px] font-mono text-label uppercase tracking-[0.07em] text-primary-text">
              {t.home.thisOrder}
            </div>
            <div className="font-mono text-[13px] font-bold text-brand-near-black">
              {formatEur(globalOrderTotal)}
            </div>
          </div>
          <div
            className={`flex-1 bg-white/35 p-[9px_13px] ${
              isNegative ? "border-l border-brand-red/30" : "border-l border-primary-mid"
            }`}
          >
            <div className="mb-[3px] font-mono text-label uppercase tracking-[0.07em] text-primary-text">
              {t.home.afterOrder}
            </div>
            <div
              className={`font-mono text-[13px] font-bold ${
                afterBalance < 0 ? "text-brand-red" : "text-brand-near-black"
              }`}
            >
              {formatSignedMoney(afterBalance)}
            </div>
          </div>
        </div>
        {cycleDataList.some((d) => d.feeCents > 0) && (
          <p className="mt-[6px] text-label text-muted">{t.home.feeIncluded}</p>
        )}
        {isNegative ? (
          <div className="mt-[12px]">
            <Link
              href="/ricarica"
              className="flex w-full items-center justify-center rounded-full bg-brand-red px-4 py-[10px] text-[14px] font-bold text-white"
            >
              {t.home.rechargeButton}
            </Link>
          </div>
        ) : (
          <div className="mt-[10px] text-right">
            <Link href="/ricarica" className="font-mono text-label font-bold uppercase tracking-widest text-primary-text">
              {t.home.rechargeLink} →
            </Link>
          </div>
        )}
      </div>

        </>
      )}

      {payPerOrder && <BalanceDueCard cents={consolidatedCents} canPay={settings.onlineTopupAvailable} />}

      {/* ── Prossimo ritiro card ── */}
      {nextPickup && <NextPickupCard pickup={nextPickup} />}

      {/* ── Cycles loop ── */}
      {cycleDataList.length > 0 ? (
        cycleDataList.map(({ cycle, cycleProducts, myLines, orderTotal, payStatus }) => {
          const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));
          return (
            <div key={cycle.cycleId} className="mb-[24px]">
              <div className="mb-[14px]">
                <CycleCountdown
                  cycleId={cycle.cycleId}
                  title={cycle.title}
                  orderCloseAt={new Date(cycle.orderCloseAt ?? new Date()).toISOString()}
                  orderOpenAt={new Date(cycle.orderOpenAt ?? cycle.createdAt).toISOString()}
                  pickupDate={cycle.pickupDate ? new Date(cycle.pickupDate).toISOString() : null}
                  pickupEndTime={cycle.pickupEndTime ?? null}
                  pickup2Date={cycle.pickup2Date ? new Date(cycle.pickup2Date).toISOString() : null}
                  pickup2EndTime={cycle.pickup2EndTime ?? null}
                />
              </div>

              {payStatus && (
                <Link
                  href={`/ordine?cycleId=${cycle.cycleId}`}
                  className={`mb-[10px] flex items-center justify-between rounded-[14px] border px-4 py-[10px] text-[14px] font-semibold ${
                    payStatus.kind === "paid"
                      ? "border-accent/25 bg-accent-soft text-accent-text"
                      : "border-primary-mid bg-primary-soft text-primary-text"
                  }`}
                >
                  <span>
                    {payStatus.kind === "draft"
                      ? t.order.pay.statusDraft(formatEur(payStatus.amountCents / 100))
                      : payStatus.kind === "paid"
                        ? t.order.pay.statusPaid(formatEur(payStatus.amountCents / 100))
                        : payStatus.kind === "changes"
                          ? t.order.pay.statusChanges(formatEur(payStatus.amountCents / 100))
                          : t.order.pay.statusChangesNoPay}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}

              {myLines.length > 0 ? (
                <div className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between border-b border-brand-border px-4 py-[14px]">
                    <span className="font-mono text-label uppercase tracking-[0.1em] text-brand-gray">
                      {t.home.yourOrder}
                    </span>
                    <Link
                      href={`/ordine?cycleId=${cycle.cycleId}`}
                      className="rounded-full border border-brand-border px-[13px] py-[5px] font-mono text-label font-bold uppercase tracking-widest text-brand-near-black"
                    >
                      {t.home.editButton}
                    </Link>
                  </div>
                  {myLines.map((line) => {
                    const p = productMap.get(line.productId);
                    const meta = [p?.variant, p?.format].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={line.orderLineId}
                        className="flex items-center justify-between border-b border-brand-border px-4 py-[11px] last:border-none"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-[1px] shrink-0 text-[18px] leading-none">
                            {getProductEmoji(p?.name ?? "")}
                          </span>
                          <div>
                            <div className="text-[14px] font-medium text-brand-near-black">
                              {p?.name ?? "?"}
                            </div>
                            {meta && (
                              <div className="mt-[1px] font-mono text-label text-brand-gray">{meta}</div>
                            )}
                          </div>
                        </div>
                        <div className="font-mono text-[13px] font-semibold text-brand-near-black">
                          ×{line.quantity} · {formatEur(parseFloat(line.lineTotal))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between rounded-b-[18px] border-t border-brand-border bg-[#f5f1ec] px-4 py-[12px]">
                    <span className="text-[14px] font-extrabold text-brand-near-black">{t.home.totalLabel}</span>
                    <span className="font-mono text-[13px] font-bold text-brand-near-black">
                      {formatEur(orderTotal)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-[18px] border border-brand-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <span className="text-[14px] text-brand-gray">{t.home.noOrdersYet}</span>
                  <Link
                    href={`/ordine?cycleId=${cycle.cycleId}`}
                    className="rounded-full bg-primary px-4 py-[10px] text-[14px] font-bold text-on-primary"
                  >
                    {t.home.orderButton}
                  </Link>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="mb-[14px] flex items-center justify-between rounded-[18px] border border-brand-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div>
            <div className="text-[15px] font-bold">{t.home.noOpenOrders}</div>
            <div className="font-mono text-label text-muted">
              {t.home.noOpenOrdersHint}
            </div>
          </div>
          <span className="rounded-full bg-black/[0.06] px-2.5 py-1 font-mono text-label text-brand-gray">
            {t.home.closed}
          </span>
        </div>
      )}

      {/* ── Recent movements ── */}
      {recentMovements.length > 0 && (
        <div className="mt-[4px]">
          <div className="mb-[10px] flex items-center justify-between">
            <span className="font-mono text-label uppercase tracking-[0.1em] text-brand-gray">
              {t.home.recentMovements}
            </span>
            <Link
              href="/storico"
              className="font-mono text-label font-bold text-primary-text"
            >
              {t.home.seeAll}
            </Link>
          </div>
          {recentMovements.map((e) => {
            const isPos = parseFloat(e.amount) >= 0;
            const label = movementText(e, t.history);
            return (
              <div
                key={e.entryId}
                className="flex items-center justify-between border-b border-brand-border py-[11px] last:border-none"
              >
                <div>
                  <div className="text-[14px] font-medium text-brand-near-black">{label}</div>
                  <div className="mt-[2px] font-mono text-label text-muted">
                    {formatDateShort(e.entryDate)}
                  </div>
                </div>
                <div
                  className={`font-mono text-[13px] font-semibold ${isPos ? "text-accent-text" : "text-brand-red"}`}
                >
                  {formatSignedMoney(e.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

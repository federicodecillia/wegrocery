import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CycleCountdown } from "@/components/home/cycle-countdown";
import { NextPickupCard } from "@/components/home/next-pickup-card";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberLedger,
  getMemberOrderLines,
  getNextMemberPickup,
  getOpenCycles,
} from "@/lib/db/queries";
import { canAccessCycle, formatDateShort, formatEur, formatEurSigned, getProductEmoji } from "@/lib/utils";

export default async function HomePage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, openCycles, recentMovements, nextPickup] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycles(),
    getMemberLedger(memberId, 4),
    getNextMemberPickup(memberId),
  ]);

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));

  const cycleDataList = await Promise.all(
    activeCycles.map(async (cycle) => {
      const [cycleProducts, myLines] = await Promise.all([
        getCycleProducts(cycle.cycleId),
        getMemberOrderLines(memberId, cycle.cycleId),
      ]);
      const orderTotal = myLines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
      return { cycle, cycleProducts, myLines, orderTotal };
    })
  );

  const globalOrderTotal = cycleDataList.reduce((sum, d) => sum + (isNaN(d.orderTotal) ? 0 : d.orderTotal), 0);
  const afterBalance = (balance || 0) - globalOrderTotal;

  const isNegative = balance < 0;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      {/* ── Saldo hero card ── */}
      <div
        className={`mb-[14px] rounded-[20px] p-[20px_22px_22px] ${
          isNegative
            ? "border-[1.5px] border-[#f9c8c8] bg-brand-red-light"
            : "border-[1.5px] border-brand-orange-mid bg-brand-orange-light"
        }`}
      >
        <div
          className={`mb-[10px] font-mono text-[10px] font-semibold uppercase tracking-[0.13em] ${
            isNegative ? "text-brand-red" : "text-brand-orange"
          }`}
        >
          {t.home.balanceTitle}
        </div>
        <div className="mb-[16px] flex items-baseline gap-[6px]">
          <span
            className={`text-[70px] font-black leading-none tracking-[-0.045em] ${
              isNegative ? "text-brand-red" : "text-brand-near-black"
            }`}
          >
            {formatMoney(Math.abs(balance))}
          </span>
        </div>
        <div
          className={`flex overflow-hidden rounded-[12px] ${
            isNegative ? "border border-[#f9c8c8]" : "border border-brand-orange-mid"
          }`}
        >
          <div className="flex-1 bg-white/60 p-[9px_13px]">
            <div className="mb-[3px] font-mono text-[10px] uppercase tracking-[0.07em] text-[#a07020]">
              {t.home.thisOrder}
            </div>
            <div className="font-mono text-[13px] font-bold text-brand-near-black">
              {formatEur(globalOrderTotal)}
            </div>
          </div>
          <div
            className={`flex-1 bg-white/35 p-[9px_13px] ${
              isNegative ? "border-l border-[#f9c8c8]" : "border-l border-brand-orange-mid"
            }`}
          >
            <div className="mb-[3px] font-mono text-[10px] uppercase tracking-[0.07em] text-[#a07020]">
              {t.home.afterOrder}
            </div>
            <div
              className={`font-mono text-[13px] font-bold ${
                afterBalance < 0 ? "text-brand-red" : "text-brand-near-black"
              }`}
            >
              {formatEur(afterBalance)}
              {afterBalance < 0 && " −"}
            </div>
          </div>
        </div>
        {isNegative && (
          <div className="mt-[12px]">
            <Link
              href="/storico"
              className="flex w-full items-center justify-center rounded-full bg-brand-red px-4 py-[10px] text-[13px] font-bold text-white"
            >
              {t.home.rechargeButton}
            </Link>
          </div>
        )}
      </div>

      {/* ── Prossimo ritiro card ── */}
      {nextPickup && <NextPickupCard pickup={nextPickup} />}

      {/* ── Cycles loop ── */}
      {cycleDataList.length > 0 ? (
        cycleDataList.map(({ cycle, cycleProducts, myLines, orderTotal }) => {
          const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));
          return (
            <div key={cycle.cycleId} className="mb-[24px]">
              <div className="mb-[14px]">
                <CycleCountdown
                  title={cycle.title}
                  orderCloseAt={new Date(cycle.orderCloseAt ?? new Date()).toISOString()}
                  orderOpenAt={new Date(cycle.orderOpenAt ?? cycle.createdAt).toISOString()}
                  pickupDate={cycle.pickupDate ? new Date(cycle.pickupDate).toISOString() : null}
                  pickupEndTime={cycle.pickupEndTime ?? null}
                  pickup2Date={cycle.pickup2Date ? new Date(cycle.pickup2Date).toISOString() : null}
                  pickup2EndTime={cycle.pickup2EndTime ?? null}
                />
              </div>

              {myLines.length > 0 ? (
                <div className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between border-b border-brand-border px-4 py-[14px]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-brand-gray">
                      {t.home.yourOrder}
                    </span>
                    <Link
                      href={`/ordine?cycleId=${cycle.cycleId}`}
                      className="rounded-full border border-brand-border px-[13px] py-[5px] font-mono text-[11px] font-bold uppercase tracking-widest text-brand-near-black"
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
                              <div className="mt-[1px] font-mono text-[11px] text-brand-gray">{meta}</div>
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
                    <span className="text-[13px] font-extrabold text-brand-near-black">{t.home.totalLabel}</span>
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
                    className="rounded-full bg-brand-orange px-4 py-[10px] text-[13px] font-bold text-white"
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
            <div className="font-mono text-[10px] text-brand-gray-light">
              {t.home.noOpenOrdersHint}
            </div>
          </div>
          <span className="rounded-full bg-black/[0.06] px-2.5 py-1 font-mono text-[10px] text-brand-gray">
            {t.home.closed}
          </span>
        </div>
      )}

      {/* ── Recent movements ── */}
      {recentMovements.length > 0 && (
        <div className="mt-[4px]">
          <div className="mb-[10px] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-brand-gray">
              {t.home.recentMovements}
            </span>
            <Link
              href="/storico"
              className="font-mono text-[10px] font-bold text-brand-orange"
            >
              {t.home.seeAll}
            </Link>
          </div>
          {recentMovements.map((e) => {
            const isPos = parseFloat(e.amount) >= 0;
            const typeLabel =
              e.type === "topup"
                ? t.history.transfer
                : e.type === "order_charge"
                  ? t.history.orderCharge
                  : t.history.correction;
            const label = typeLabel + (e.note ? " · " + e.note : "");
            return (
              <div
                key={e.entryId}
                className="flex items-center justify-between border-b border-brand-border py-[11px] last:border-none"
              >
                <div>
                  <div className="text-[13px] font-medium text-brand-near-black">{label}</div>
                  <div className="mt-[2px] font-mono text-[10px] text-brand-gray-light">
                    {formatDateShort(e.entryDate)}
                  </div>
                </div>
                <div
                  className={`font-mono text-[13px] font-semibold ${isPos ? "text-brand-teal" : "text-brand-red"}`}
                >
                  {formatEurSigned(parseFloat(e.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { formatNumber, formatSignedMoney } from "@/lib/i18n/format";
import { formatDate, formatEur, getProductEmoji } from "@/lib/utils";
import type { CycleHistoryEntry } from "@/lib/cycle-history";
import { MovementIcon } from "@/components/movement-icon";
import { movementKind, movementText } from "@/lib/movement-label";
import { MovementDetailDialog, type MovementDetail } from "./movement-detail";

type LedgerEntry = MovementDetail & { entryId: string };

type Props = {
  orderHistory: CycleHistoryEntry[];
  movements: LedgerEntry[];
  balance: number;
};

export function StoricoTabs({ orderHistory, movements, balance }: Props) {
  const searchParams = useSearchParams();
  const deepLinkCycleId = searchParams.get("cycleId");

  const [tab, setTab] = useState<"ordini" | "movimenti">("ordini");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => (deepLinkCycleId ? new Set([deepLinkCycleId]) : new Set()),
  );
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  // The cycle card to bring into view: the notification deep link on arrival,
  // or the cycle picked from a movement's detail.
  const [scrollTarget, setScrollTarget] = useState<string | null>(deepLinkCycleId);
  const cycleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!scrollTarget || tab !== "ordini") return;
    cycleRefs.current.get(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollTarget(null);
  }, [scrollTarget, tab]);

  // From a movement's detail to its cycle, opened, on the Ordini tab.
  function showCycle(cycleId: string) {
    setSelected(null);
    setTab("ordini");
    setExpanded((prev) => new Set(prev).add(cycleId));
    setScrollTarget(cycleId);
  }

  function toggleExpand(cycleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) next.delete(cycleId);
      else next.add(cycleId);
      return next;
    });
  }

  return (
    <>
      {/* Segmented tabs */}
      <div className="mb-5 flex rounded-[12px] bg-black/[0.07] p-1">
        {(["ordini", "movimenti"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 rounded-[10px] py-[9px] text-[14px] font-semibold transition-all ${
              tab === tabKey
                ? "bg-white text-brand-near-black shadow-[0_1px_4px_rgba(45,43,41,0.10)]"
                : "bg-transparent text-brand-gray"
            }`}
          >
            {tabKey === "ordini" ? t.history.orders : t.history.movements}
          </button>
        ))}
      </div>

      {/* Ordini tab */}
      {tab === "ordini" && (
        <>
          {orderHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 text-4xl">🛒</span>
              <h2 className="text-[16px] font-bold text-brand-near-black">{t.history.noOrders}</h2>
              <p className="mt-1 text-[14px] text-brand-gray">{t.history.noOrdersHint}</p>
            </div>
          ) : (
            orderHistory.map((o) => {
              const isOpen = expanded.has(o.cycleId);
              return (
                <div
                  key={o.cycleId}
                  ref={(el) => {
                    if (el) cycleRefs.current.set(o.cycleId, el);
                    else cycleRefs.current.delete(o.cycleId);
                  }}
                  className="mb-3 overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <button
                    onClick={() => toggleExpand(o.cycleId)}
                    className="flex w-full items-center justify-between border-b border-brand-border px-4 py-[14px] text-left"
                  >
                    <div>
                      <div className="text-[14px] font-bold tracking-[-0.01em] text-brand-near-black">
                        {o.title}
                      </div>
                      <div className="mt-[2px] font-mono text-label text-muted">
                        {formatDate(o.pickupDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-bold text-brand-near-black">
                        {o.charged ? formatSignedMoney(o.net) : formatEur(o.productsTotal)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-label ${
                          o.status === "cancelled"
                            ? "bg-brand-red-light text-brand-red"
                            : "bg-accent-soft text-accent-text"
                        }`}
                      >
                        {o.status === "open"
                          ? t.history.open
                          : o.status === "cancelled"
                            ? t.history.cancelled
                            : t.history.pickedUp}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-[10px]">
                      {o.lines.length > 0 && (
                        <>
                          <div className="mb-[5px] font-mono text-label text-muted">{t.history.products}</div>
                          <div className="divide-y divide-brand-border rounded-[12px] border border-brand-border bg-[#fdfdfd]">
                            {o.lines.map((l, index) => (
                              <div key={`${l.productName}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
                                <span className="shrink-0 text-[18px] leading-none">
                                  {l.emoji || getProductEmoji(l.productName)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[14px] font-semibold text-brand-near-black">
                                    {l.productName}
                                    {l.variant && <span className="ml-1 font-normal text-brand-gray">{l.variant}</span>}
                                  </div>
                                  <div className="mt-[2px] text-label leading-snug text-brand-gray">
                                    {[l.supplierName, l.category].filter(Boolean).join(" · ")}
                                  </div>
                                  <div className="mt-[2px] font-mono text-label text-muted">
                                    {l.quantity} × {formatEur(l.unitPrice)} ={" "}
                                    {l.actualLineTotal !== null && l.actualLineTotal !== l.lineTotal ? (
                                      // Weighed by the supplier: what the member actually pays.
                                      <>
                                        <s>{formatEur(l.lineTotal)}</s>{" "}
                                        <span className="font-semibold text-brand-near-black">
                                          {formatEur(l.actualLineTotal)}
                                        </span>
                                        {l.actualQuantity !== null &&
                                          ` · ${t.history.received(
                                            `${formatNumber(l.actualQuantity)}${l.unit ? ` ${l.unit}` : ""}`,
                                          )}`}
                                      </>
                                    ) : (
                                      formatEur(l.lineTotal)
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <CycleTotals entry={o} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* Movimenti tab */}
      {tab === "movimenti" && (
        <>
          {/* Balance summary */}
          <div
            className={`mb-4 rounded-[16px] border p-4 ${
              balance < 0
                ? "border-brand-red/30 bg-brand-red-light"
                : "border-primary-mid bg-primary-soft"
            }`}
          >
            <div
              className={`mb-[6px] font-mono text-label uppercase tracking-[0.10em] ${
                balance < 0 ? "text-brand-red" : "text-primary-text"
              }`}
            >
              {t.history.currentBalance}
            </div>
            <span
              className={`text-[36px] font-black tracking-[-0.04em] ${
                balance < 0 ? "text-brand-red" : "text-brand-near-black"
              }`}
            >
              {formatSignedMoney(balance)}
            </span>
          </div>

          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 text-4xl">💰</span>
              <h2 className="text-[16px] font-bold text-brand-near-black">{t.history.noMovements}</h2>
              <p className="mt-1 text-[14px] text-brand-gray">{t.history.noMovementsHint}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {movements.map((e) => {
                const isPos = parseFloat(e.amount) >= 0;
                const fullLabel = movementText(e, t.history);
                return (
                  <button
                    key={e.entryId}
                    type="button"
                    onClick={() => setSelected(e)}
                    className="flex w-full items-center justify-between border-b border-brand-border px-4 py-[13px] text-left last:border-none"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <MovementIcon kind={movementKind(e)} incoming={isPos} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-brand-near-black">
                          {fullLabel}
                        </div>
                        <div className="mt-[2px] font-mono text-label text-muted">
                          {formatDate(e.entryDate)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`ml-3 font-mono text-[14px] font-bold ${
                        isPos ? "text-accent-text" : "text-brand-red"
                      }`}
                    >
                      {formatSignedMoney(e.amount)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <MovementDetailDialog entry={selected} onClose={() => setSelected(null)} onShowCycle={showCycle} />
    </>
  );
}

// What the cycle moved on the balance, as the ledger sums it. Products and
// shipping are costs, so they read negative like the rows they add up to.
function CycleTotals({ entry }: { entry: CycleHistoryEntry }) {
  if (!entry.charged) {
    return <p className="mt-[10px] font-mono text-label text-brand-gray">{t.history.chargedAtClose}</p>;
  }
  return (
    <div className="mt-[10px] space-y-[3px] font-mono text-label text-brand-gray">
      <TotalRow label={t.history.products} value={formatSignedMoney(-entry.productsTotal)} />
      {entry.shipping !== 0 && (
        <TotalRow label={t.history.shipping} value={formatSignedMoney(-entry.shipping)} />
      )}
      {entry.corrections !== 0 && (
        <TotalRow label={t.history.corrections} value={formatSignedMoney(entry.corrections)} />
      )}
      <div className="flex justify-between border-t border-brand-border pt-[5px] text-[12px] font-bold text-brand-near-black">
        <span>{t.history.cycleNet}</span>
        <span>{formatSignedMoney(entry.net)}</span>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

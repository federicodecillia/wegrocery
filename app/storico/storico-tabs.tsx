"use client";

import { EmptyIcon } from "@/components/ui-icon";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { formatNumber, formatSignedMoney } from "@/lib/i18n/format";
import { formatDate, formatEur, memberProductEmoji } from "@/lib/utils";
import type { CycleHistoryEntry } from "@/lib/cycle-history";
import { BalanceSummary } from "@/components/balance/balance-summary";
import { MovementRow } from "@/components/movement-row";
import { useWide } from "@/lib/ui/use-wide";
import { MovementDetailDialog, MovementDetailPanel, type MovementDetail } from "./movement-detail";

type LedgerEntry = MovementDetail & { entryId: string; correctedAt?: string | null };

type Tab = "ordini" | "movimenti";
const TABS: Tab[] = ["ordini", "movimenti"];

type Props = {
  orderHistory: CycleHistoryEntry[];
  movements: LedgerEntry[];
  balance: number;
};

export function StoricoTabs({ orderHistory, movements, balance }: Props) {
  const searchParams = useSearchParams();
  const deepLinkCycleId = searchParams.get("cycleId");

  // From lg the list and its detail sit side by side; below, a cycle opens
  // in place and a movement in a sheet.
  const wide = useWide();
  const [tab, setTabState] = useState<Tab>(searchParams.get("tab") === "movimenti" ? "movimenti" : "ordini");
  // The cycle shown beside the list from lg: the deep link, else the newest.
  const [picked, setPicked] = useState<string | null>(deepLinkCycleId);
  const shownCycle = orderHistory.find((o) => o.cycleId === picked) ?? orderHistory[0] ?? null;
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

  // The tab is in the URL (?tab=movimenti), so a link or a reload opens it.
  function setTab(next: Tab) {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      if (next === "movimenti") url.searchParams.set("tab", next);
      else url.searchParams.delete("tab");
      window.history.replaceState(null, "", url);
    } catch {
      // The tab still switches; only the address stays as it was.
    }
  }

  function onTabKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  // From a movement's detail to its cycle, opened, on the Ordini tab.
  function showCycle(cycleId: string) {
    setSelected(null);
    setTab("ordini");
    setPicked(cycleId);
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
      <h1 className="mb-3 text-title font-black text-brand-near-black">{t.nav.history}</h1>
      {/* Segmented tabs */}
      <div role="tablist" aria-label={t.nav.history} className="mb-5 flex rounded-xl bg-black/[0.07] p-1 lg:max-w-[420px]">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            id={`tab-${tabKey}`}
            type="button"
            role="tab"
            aria-selected={tab === tabKey}
            aria-controls={`panel-${tabKey}`}
            tabIndex={tab === tabKey ? 0 : -1}
            onClick={() => setTab(tabKey)}
            onKeyDown={onTabKey}
            className={`flex-1 rounded-lg py-[9px] text-[14px] font-semibold transition-all ${
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
        <div id="panel-ordini" role="tabpanel" aria-labelledby="tab-ordini" className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          <div className="min-w-0">
          {orderHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <EmptyIcon name="cart" />
              <h2 className="text-[16px] font-bold text-brand-near-black">{t.history.noOrders}</h2>
              <p className="mt-1 text-[14px] text-brand-gray">{t.history.noOrdersHint}</p>
            </div>
          ) : (
            orderHistory.map((o) => {
              const isOpen = expanded.has(o.cycleId);
              const isShown = shownCycle?.cycleId === o.cycleId;
              return (
                <div
                  key={o.cycleId}
                  ref={(el) => {
                    if (el) cycleRefs.current.set(o.cycleId, el);
                    else cycleRefs.current.delete(o.cycleId);
                  }}
                  className={`mb-3 overflow-hidden rounded-card border bg-white shadow-card ${
                    isShown ? "lg:border-primary-mid lg:bg-primary-soft" : "border-brand-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (wide ? setPicked(o.cycleId) : toggleExpand(o.cycleId))}
                    aria-expanded={wide ? undefined : isOpen}
                    aria-current={wide && isShown ? "true" : undefined}
                    className="flex w-full items-center justify-between gap-3 border-b border-brand-border px-4 py-[14px] text-left hover:bg-black/[0.02] lg:border-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold tracking-[-0.01em] text-brand-near-black">
                        {o.title}
                      </div>
                      <div className="mt-[2px] font-mono text-label text-muted">
                        {formatDate(o.pickupDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Not charged yet: what the order costs, muted and unsigned
                          until the close moves the balance. */}
                      <span
                        className={`whitespace-nowrap font-mono text-[15px] font-bold tabular-nums ${
                          o.charged ? "text-brand-near-black" : "text-muted"
                        }`}
                      >
                        {o.charged ? formatSignedMoney(o.net) : formatEur(o.productsTotal)}
                      </span>
                      <Badge tone={o.status === "cancelled" ? "danger" : "accent"}>
                        {o.status === "open"
                          ? t.history.open
                          : o.status === "cancelled"
                            ? t.history.cancelled
                            : t.history.pickedUp}
                      </Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-[10px] lg:hidden">
                      <CycleDetail entry={o} />
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>
          {shownCycle && (
            <section aria-labelledby="cycle-detail-title" className="hidden rounded-card border border-brand-border bg-white p-4 shadow-card lg:sticky lg:top-4 lg:block">
              <h2 id="cycle-detail-title" className="text-[15px] font-bold text-brand-near-black">{shownCycle.title}</h2>
              <p className="mt-[2px] mb-3 font-mono text-label text-muted">{formatDate(shownCycle.pickupDate)}</p>
              <CycleDetail entry={shownCycle} />
            </section>
          )}
        </div>
      )}

      {/* Movimenti tab */}
      {tab === "movimenti" && (
        <div id="panel-movimenti" role="tabpanel" aria-labelledby="tab-movimenti" className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
          <div className="min-w-0">
          <div className="lg:hidden">
            <BalanceSummary label={t.history.currentBalance} balance={balance} />
          </div>
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <EmptyIcon name="wallet" />
              <h2 className="text-[16px] font-bold text-brand-near-black">{t.history.noMovements}</h2>
              <p className="mt-1 text-[14px] text-brand-gray">{t.history.noMovementsHint}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-brand-border bg-white shadow-card">
              {movements.map((e) => (
                <MovementRow
                  key={e.entryId}
                  entry={e}
                  inset
                  onSelect={() => setSelected(e)}
                  selected={wide && selected?.entryId === e.entryId}
                />
              ))}
            </div>
          )}
          </div>
          {/* From lg: the selected movement, else the balance. */}
          <div className="hidden lg:sticky lg:top-4 lg:block">
            {wide && selected ? (
              <MovementDetailPanel entry={selected} onClose={() => setSelected(null)} onShowCycle={showCycle} />
            ) : (
              <BalanceSummary label={t.history.currentBalance} balance={balance} />
            )}
          </div>
        </div>
      )}

      <MovementDetailDialog entry={wide ? null : selected} onClose={() => setSelected(null)} onShowCycle={showCycle} />
    </>
  );
}

// A cycle's products and totals: in place below lg, beside the list from lg.
function CycleDetail({ entry }: { entry: CycleHistoryEntry }) {
  return (
    <>
      {entry.lines.length > 0 && (
        <>
          <div className="mb-[5px] font-mono text-label text-muted">{t.history.products}</div>
          <div className="divide-y divide-brand-border rounded-xl border border-brand-border bg-white">
            {entry.lines.map((l, index) => (
              <div key={`${l.productName}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
                <span aria-hidden="true" className="w-[18px] shrink-0 text-[18px] leading-none">
                  {memberProductEmoji(l.emoji, l.productName)}
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
      <CycleTotals entry={entry} />
    </>
  );
}

// What the cycle moved on the balance, as the ledger sums it. Products and
// shipping and the preparation fee are costs, so they read negative like the rows they add up to.
function CycleTotals({ entry }: { entry: CycleHistoryEntry }) {
  const perOrder = entry.paymentMode === "per_order";
  if (!entry.charged) {
    return (
      <div className="mt-[10px] space-y-[3px] font-mono text-label text-brand-gray">
        {perOrder && entry.paid !== 0 && <TotalRow label={t.history.paid} value={formatSignedMoney(entry.paid)} />}
        <p>{perOrder ? t.history.settledAtClose : t.history.chargedAtClose}</p>
      </div>
    );
  }
  return (
    <div className="mt-[10px] space-y-[3px] font-mono text-label text-brand-gray">
      {perOrder && <TotalRow label={t.history.paid} value={formatSignedMoney(entry.paid)} />}
      <TotalRow label={t.history.products} value={formatSignedMoney(-entry.productsTotal)} />
      {entry.shipping !== 0 && (
        <TotalRow label={t.history.shipping} value={formatSignedMoney(-entry.shipping)} />
      )}
      {entry.handling !== 0 && (
        <TotalRow label={t.history.handlingFee} value={formatSignedMoney(-entry.handling)} />
      )}
      {entry.corrections !== 0 && (
        <TotalRow label={t.history.corrections} value={formatSignedMoney(entry.corrections)} />
      )}
      {perOrder && entry.refunded !== 0 && (
        <TotalRow label={t.history.refunded} value={formatSignedMoney(-entry.refunded)} />
      )}
      <div className="flex justify-between border-t border-brand-border pt-[5px] text-[12px] font-bold text-brand-near-black">
        <span>{perOrder ? t.history.cycleNetPerOrder : t.history.cycleNet}</span>
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

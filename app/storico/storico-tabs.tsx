"use client";

import { EmptyIcon } from "@/components/ui-icon";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { formatNumber, formatSignedMoney } from "@/lib/i18n/format";
import { formatDate, formatEur, memberProductEmoji } from "@/lib/utils";
import type { CycleHistoryEntry, HistoryBadge } from "@/lib/cycle-history";
import { BalanceSummary } from "@/components/balance/balance-summary";
import { MovementRow } from "@/components/movement-row";
import { useWide } from "@/lib/ui/use-wide";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { BankReceipt } from "@/components/ricarica/bank-receipt";
import { CopyField } from "@/components/ricarica/copy-field";
import type { OrderBankReferences } from "@/lib/payments/order-reference";
import Link from "next/link";
import { MovementDetailDialog, MovementDetailPanel, type MovementDetail } from "./movement-detail";

type LedgerEntry = MovementDetail & { entryId: string; correctedAt?: string | null };

type Tab = "ordini" | "movimenti";
const TABS: Tab[] = ["ordini", "movimenti"];

type Props = {
  orderHistory: (CycleHistoryEntry & { badge: HistoryBadge })[];
  movements: LedgerEntry[];
  balance: number;
  // null when the group has the bank transfer off.
  bankRefs: OrderBankReferences | null;
};

export function StoricoTabs({ orderHistory, movements, balance, bankRefs }: Props) {
  const searchParams = useSearchParams();
  const deepLinkCycleId = searchParams.get("cycleId");

  // From lg the list and its detail sit side by side; below, a cycle and a
  // movement each open in a sheet.
  const wide = useWide();
  const [tab, setTabState] = useState<Tab>(searchParams.get("tab") === "movimenti" ? "movimenti" : "ordini");
  // The cycle shown beside the list from lg: the deep link, else the newest.
  const [picked, setPicked] = useState<string | null>(deepLinkCycleId);
  const shownCycle = orderHistory.find((o) => o.cycleId === picked) ?? orderHistory[0] ?? null;
  // The cycle open in the sheet below lg (a notification deep link opens it).
  const [sheetCycleId, setSheetCycleId] = useState<string | null>(deepLinkCycleId);
  const sheetCycle = wide ? null : (orderHistory.find((o) => o.cycleId === sheetCycleId) ?? null);
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
    setSheetCycleId(cycleId);
    setScrollTarget(cycleId);
  }

  function openCycle(cycleId: string) {
    setPicked(cycleId);
    setSheetCycleId(cycleId);
  }

  return (
    <>
      <h1 className="mb-3 text-title font-black text-foreground">{t.nav.history}</h1>
      {/* Segmented tabs */}
      <div role="tablist" aria-label={t.nav.history} className="mb-5 flex rounded-xl bg-tint/[0.07] p-1 lg:max-w-[420px]">
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
            className={`flex-1 rounded-lg py-2.25 text-[14px] font-semibold transition-all ${
              tab === tabKey
                ? "bg-card text-foreground shadow-[0_1px_4px_rgba(45,43,41,0.10)]"
                : "bg-transparent text-secondary-foreground"
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
              <h2 className="text-[16px] font-bold text-foreground">{t.history.noOrders}</h2>
              <p className="mt-1 text-[14px] text-secondary-foreground">{t.history.noOrdersHint}</p>
            </div>
          ) : (
            orderHistory.map((o) => {
              const isShown = shownCycle?.cycleId === o.cycleId;
              return (
                <div
                  key={o.cycleId}
                  ref={(el) => {
                    if (el) cycleRefs.current.set(o.cycleId, el);
                    else cycleRefs.current.delete(o.cycleId);
                  }}
                  className={`mb-3 overflow-hidden rounded-card border bg-card shadow-card ${
                    isShown ? "lg:border-primary-mid lg:bg-primary-bg" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openCycle(o.cycleId)}
                    aria-haspopup={wide ? undefined : "dialog"}
                    aria-current={wide && isShown ? "true" : undefined}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-tint/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold tracking-[-0.01em] text-foreground">
                        {o.title}
                      </div>
                      <div className="mt-0.5 tabular-nums text-label text-muted-foreground">
                        {formatDate(o.pickupDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Not charged yet: what the order costs, muted and unsigned
                          until the close moves the balance. */}
                      <span
                        className={`whitespace-nowrap text-[15px] font-bold tabular-nums ${
                          o.charged ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {o.charged ? formatSignedMoney(o.net) : formatEur(o.productsTotal)}
                      </span>
                      <Badge variant={o.badge === "cancelled" ? "destructive" : "accent"}>
                        {t.history[o.badge]}
                      </Badge>
                    </div>
                  </button>
                </div>
              );
            })
          )}
          </div>
          {shownCycle && (
            <section aria-labelledby="cycle-detail-title" className="hidden rounded-card border border-border bg-card p-4 shadow-card lg:sticky lg:top-4 lg:block">
              <h2 id="cycle-detail-title" className="text-[15px] font-bold text-foreground">{shownCycle.title}</h2>
              <p className="mt-0.5 mb-3 tabular-nums text-label text-muted-foreground">{formatDate(shownCycle.pickupDate)}</p>
              <CycleDetail entry={shownCycle} bankRefs={bankRefs} />
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
              <h2 className="text-[16px] font-bold text-foreground">{t.history.noMovements}</h2>
              <p className="mt-1 text-[14px] text-secondary-foreground">{t.history.noMovementsHint}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
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
      <Sheet
        open={sheetCycle !== null}
        onRequestClose={() => setSheetCycleId(null)}
        size="sm"
        title={sheetCycle?.title}
        subtitle={(sheetCycle && formatDate(sheetCycle.pickupDate)) || undefined}
        footer={
          <Button block onClick={() => setSheetCycleId(null)}>
            {t.common.close}
          </Button>
        }
      >
        {sheetCycle && <CycleDetail entry={sheetCycle} bankRefs={bankRefs} />}
      </Sheet>
    </>
  );
}

// A cycle's products and totals: in a sheet below lg, beside the list from lg.
function CycleDetail({ entry, bankRefs }: { entry: CycleHistoryEntry; bankRefs: OrderBankReferences | null }) {
  const reference = bankRefs?.references[entry.cycleId];
  return (
    <>
      {entry.lines.length > 0 && (
        <>
          <div className="mb-1.25 tabular-nums text-label text-muted-foreground">{t.history.products}</div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {entry.lines.map((l, index) => (
              <div key={`${l.productName}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
                <span aria-hidden="true" className="w-[18px] shrink-0 text-[18px] leading-none">
                  {memberProductEmoji(l.emoji, l.productName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-foreground">
                    {l.productName}
                    {l.variant && <span className="ml-1 font-normal text-secondary-foreground">{l.variant}</span>}
                  </div>
                  <div className="mt-0.5 text-label leading-snug text-secondary-foreground">
                    {[l.supplierName, l.category].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-0.5 tabular-nums text-label text-muted-foreground">
                    {l.quantity} × {formatEur(l.unitPrice)} ={" "}
                    {l.actualLineTotal !== null && l.actualLineTotal !== l.lineTotal ? (
                      // Weighed by the supplier: what the member actually pays.
                      <>
                        <s>{formatEur(l.lineTotal)}</s>{" "}
                        <span className="font-semibold text-foreground">
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
      {reference && (
        <section className="mt-4 rounded-xl border border-border bg-background p-3">
          <h3 className="text-[14px] font-bold text-foreground">{t.topup.bankOrderTitle}</h3>
          <p className="mt-1 text-[14px] text-secondary-foreground">{t.topup.bankOrderHint}</p>
          <CopyField label={t.topup.bankReference} value={reference} />
          {bankRefs?.receiptEmail && <BankReceipt email={bankRefs.receiptEmail} subject={reference} />}
          <Link href="/ricarica" className="mt-2 inline-block text-[14px] font-semibold text-primary-text">
            {t.topup.bankDetailsLink}
          </Link>
        </section>
      )}
    </>
  );
}

// What the cycle moved on the balance, as the ledger sums it. Products and
// shipping and the preparation fee are costs, so they read negative like the rows they add up to.
function CycleTotals({ entry }: { entry: CycleHistoryEntry }) {
  const perOrder = entry.paymentMode === "per_order";
  if (!entry.charged) {
    return (
      <div className="mt-2.5 space-y-0.75 tabular-nums text-label text-secondary-foreground">
        {perOrder && entry.paid !== 0 && <TotalRow label={t.history.paid} value={formatSignedMoney(entry.paid)} />}
        <p>{perOrder ? t.history.settledAtClose : t.history.chargedAtClose}</p>
      </div>
    );
  }
  return (
    <div className="mt-2.5 space-y-0.75 tabular-nums text-label text-secondary-foreground">
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
      <div className="flex justify-between border-t border-border pt-1.25 text-[12px] font-bold text-foreground">
        <span>{perOrder ? t.history.cycleNetPerOrder : t.history.cycleNet}</span>
        <span className="tabular-nums">{formatSignedMoney(entry.net)}</span>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

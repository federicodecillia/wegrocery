"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate, formatEur, formatEurSigned, getProductEmoji } from "@/lib/utils";
import type { CycleHistoryEntry } from "@/lib/db/queries";

type LedgerEntry = {
  entryId: string;
  type: string;
  amount: string;
  note: string | null;
  entryDate: Date;
};

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
  const cycleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // When arriving from a notification deep-link, scroll the targeted cycle
  // card into view after the initial render.
  useEffect(() => {
    if (!deepLinkCycleId) return;
    const el = cycleRefs.current.get(deepLinkCycleId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [deepLinkCycleId]);

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
        {(["ordini", "movimenti"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-[10px] py-[9px] text-[13px] font-semibold transition-all ${
              tab === t
                ? "bg-white text-pm-near-black shadow-[0_1px_4px_rgba(45,43,41,0.10)]"
                : "bg-transparent text-pm-gray"
            }`}
          >
            {t === "ordini" ? "Ordini" : "Movimenti"}
          </button>
        ))}
      </div>

      {/* Ordini tab */}
      {tab === "ordini" && (
        <>
          {orderHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 text-4xl">🛒</span>
              <h2 className="text-[16px] font-bold text-pm-near-black">Nessun ordine</h2>
              <p className="mt-1 text-[13px] text-pm-gray">I tuoi ordini passati appariranno qui.</p>
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
                  className="mb-3 overflow-hidden rounded-[18px] border border-pm-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <button
                    onClick={() => toggleExpand(o.cycleId)}
                    className="flex w-full items-center justify-between border-b border-pm-border px-4 py-[14px] text-left"
                  >
                    <div>
                      <div className="text-[14px] font-bold tracking-[-0.01em] text-pm-near-black">
                        {o.title}
                      </div>
                      <div className="mt-[2px] font-mono text-[10px] text-pm-gray-light">
                        {formatDate(o.pickupDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-bold text-pm-near-black">
                        {formatEur(o.orderTotal)}
                      </span>
                      <span className="rounded-full bg-pm-teal-light px-2.5 py-0.5 font-mono text-[10px] text-pm-teal">
                        {o.status === "open" ? "Aperto" : "Ritirato"}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-[10px]">
                      <div className="mb-[5px] font-mono text-[10px] text-pm-gray-light">Prodotti</div>
                      <div className="divide-y divide-pm-border rounded-[12px] border border-pm-border bg-[#fdfdfd]">
                        {o.lines.map((l, index) => (
                          <div key={`${l.productName}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
                            <span className="shrink-0 text-[18px] leading-none">
                              {l.emoji || getProductEmoji(l.productName)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-semibold text-pm-near-black">
                                {l.productName}
                                {l.variant && <span className="ml-1 font-normal text-pm-gray">{l.variant}</span>}
                              </div>
                              <div className="mt-[2px] text-[11px] leading-snug text-pm-gray">
                                {[l.supplierName, l.category].filter(Boolean).join(" · ")}
                              </div>
                              <div className="mt-[2px] font-mono text-[10px] text-pm-gray-light">
                                {l.quantity} × {formatEur(l.unitPrice)}
                                {l.unit ? `/${l.unit}` : ""} = {formatEur(l.lineTotal)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                ? "border-[#f9c8c8] bg-pm-red-light"
                : "border-pm-orange-mid bg-pm-orange-light"
            }`}
          >
            <div
              className={`mb-[6px] font-mono text-[9px] uppercase tracking-[0.10em] ${
                balance < 0 ? "text-pm-red" : "text-pm-orange"
              }`}
            >
              Saldo attuale
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-bold text-pm-near-black/30">€</span>
              <span
                className={`text-[36px] font-black tracking-[-0.04em] ${
                  balance < 0 ? "text-pm-red" : "text-pm-near-black"
                }`}
              >
                {Math.abs(balance).toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 text-4xl">💰</span>
              <h2 className="text-[16px] font-bold text-pm-near-black">Nessun movimento</h2>
              <p className="mt-1 text-[13px] text-pm-gray">I tuoi movimenti appariranno qui.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-pm-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {movements.map((e) => {
                const isTopup = e.type === "topup";
                const isPos = parseFloat(e.amount) >= 0;
                const label =
                  e.type === "topup" ? "Bonifico" : e.type === "order_charge" ? "Ordine" : "Rettifica";
                const fullLabel = label + (e.note ? " · " + e.note : "");
                return (
                  <div
                    key={e.entryId}
                    className="flex items-center justify-between border-b border-pm-border px-4 py-[13px] last:border-none"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${
                          isTopup ? "bg-pm-teal-light" : "bg-pm-orange-light"
                        }`}
                      >
                        {isTopup ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-pm-teal">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pm-orange">
                            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-pm-near-black">
                          {fullLabel}
                        </div>
                        <div className="mt-[2px] font-mono text-[10px] text-pm-gray-light">
                          {formatDate(e.entryDate)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`ml-3 font-mono text-[14px] font-bold ${
                        isPos ? "text-pm-teal" : "text-pm-red"
                      }`}
                    >
                      {formatEurSigned(parseFloat(e.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { adminGetCycleOrderDetails } from "@/lib/actions/admin-cycles";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type OrderDetail = {
  memberId: string;
  memberName: string;
  productName: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  supplierName: string | null;
  productSupplier: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export function ClosedCycleDetails({
  cycleId,
  cycleTitle,
  buttonLabel = "Vedi ordini",
}: {
  cycleId: string;
  cycleTitle: string;
  buttonLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);

  async function handleOpen() {
    setIsOpen(true);
    setLoading(true);
    try {
      const result = await adminGetCycleOrderDetails(cycleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setOrderDetails(result.orders || []);
      }
    } catch {
      toast.error("Errore nel caricamento dettagli");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="rounded-lg bg-pm-teal/10 px-3 py-1 text-[11px] font-bold text-pm-teal hover:bg-pm-teal/20"
      >
        {buttonLabel}
      </button>
    );
  }

  // Group by member
  const grouped = orderDetails.reduce((acc: Record<string, OrderDetail[]>, ord) => {
    if (!acc[ord.memberName]) acc[ord.memberName] = [];
    acc[ord.memberName].push(ord);
    return acc;
  }, {});
  const grandTotal = orderDetails.reduce((s, l) => s + parseFloat(l.lineTotal), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[600px] flex-col rounded-2xl bg-pm-warm-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-pm-border p-5">
          <div>
            <h3 className="text-[16px] font-black text-pm-near-black">{cycleTitle}</h3>
            <p className="text-[12px] text-pm-gray">
              {Object.keys(grouped).length} soci · {formatEur(grandTotal)} da addebitare
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full bg-pm-border p-2 text-pm-gray hover:bg-pm-gray-light"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-20 text-center text-pm-gray">Caricamento in corso...</div>
          ) : orderDetails.length === 0 ? (
            <div className="py-20 text-center text-pm-gray">Nessun ordine trovato per questo ciclo.</div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([memberName, lines]) => {
                const total = lines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
                return (
                  <div key={memberName} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-pm-teal/20 pb-1">
                      <span className="text-[14px] font-bold text-pm-near-black">{memberName}</span>
                      <span className="text-[13px] font-black text-pm-teal">{formatEur(total)}</span>
                    </div>
                    <div className="space-y-1 pl-2">
                      {lines.map((l, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 text-[12px] text-pm-near-black">
                          <div className="flex min-w-0 flex-1 gap-2">
                            <span className="shrink-0 text-[16px]">{l.emoji || getProductEmoji(l.productName)}</span>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {l.productName} {l.variant && <span className="text-pm-gray">({l.variant})</span>}
                              </div>
                              <div className="truncate text-[10px] text-pm-gray">
                                {[l.supplierName ?? l.productSupplier, l.category, l.format].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 text-right font-mono text-pm-gray">
                            {l.quantity} × {formatEur(parseFloat(l.unitPrice))}
                            {l.unit ? `/${l.unit}` : ""} = {formatEur(parseFloat(l.lineTotal))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-pm-border p-4 text-center">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full rounded-xl bg-pm-near-black py-3 text-[14px] font-bold text-white shadow-lg active:scale-95"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

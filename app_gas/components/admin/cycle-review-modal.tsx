"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { formatEur, getProductEmoji } from "@/lib/utils";
import {
  adminCloseCycleWithAdjustments,
  adminGetCycleProductsForReview,
} from "@/lib/actions/admin";

type ProductRow = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  emoji: string | null;
  unitPrice: number;
  totalQty: number;
  totalAmount: number;
};

type Props = {
  cycleId: string;
  cycleTitle: string;
};

// Modal that lets the admin review per-product order totals and adjust
// the final unit price before closing the cycle. This is the entry point
// for the "actual weight differs from ordered weight" workflow — the admin
// types the corrected price (e.g. €2.40/kg instead of €2.00/kg) and the
// server action recomputes every order line and ledger charge.
export function CycleReviewCloseButton({ cycleId, cycleTitle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-pm-orange/30 bg-pm-orange-light px-4 py-2 text-[12px] font-bold text-pm-orange disabled:opacity-60"
      >
        Chiudi con rettifiche
      </button>
      {open && (
        <CycleReviewModal
          cycleId={cycleId}
          cycleTitle={cycleTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CycleReviewModal({
  cycleId,
  cycleTitle,
  onClose,
}: Props & { onClose: () => void }) {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await adminGetCycleProductsForReview(cycleId)) as ProductRow[];
        if (cancelled) return;
        setRows(data);
        setEdits(
          Object.fromEntries(data.map((r) => [r.productId, r.unitPrice.toFixed(2)])),
        );
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Errore caricamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  const adjustments = useMemo(() => {
    if (!rows) return [];
    const out: Array<{ productId: string; finalUnitPrice: number; delta: number; row: ProductRow }> = [];
    for (const r of rows) {
      const raw = (edits[r.productId] ?? "").replace(",", ".").trim();
      if (!raw) continue;
      const next = parseFloat(raw);
      if (!Number.isFinite(next) || next < 0) continue;
      // Only mark as an adjustment if the price actually changed (avoid
      // pointless writes and keeps the audit log clean).
      if (Math.abs(next - r.unitPrice) > 0.001) {
        out.push({
          productId: r.productId,
          finalUnitPrice: next,
          delta: (next - r.unitPrice) * r.totalQty,
          row: r,
        });
      }
    }
    return out;
  }, [rows, edits]);

  const newGrandTotal = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, r) => {
      const raw = (edits[r.productId] ?? "").replace(",", ".");
      const price = parseFloat(raw);
      const effective = Number.isFinite(price) && price >= 0 ? price : r.unitPrice;
      return sum + effective * r.totalQty;
    }, 0);
  }, [rows, edits]);

  const oldGrandTotal = rows?.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalDelta = newGrandTotal - oldGrandTotal;

  function handleConfirm() {
    if (!rows) return;
    const message =
      adjustments.length === 0
        ? `Nessuna rettifica. Chiudere "${cycleTitle}" con i prezzi attuali?`
        : `Applicare ${adjustments.length} rettifica/e e chiudere "${cycleTitle}"?\n\n` +
          `Variazione totale: ${totalDelta >= 0 ? "+" : ""}${totalDelta.toFixed(2).replace(".", ",")} €`;
    if (!window.confirm(message)) return;

    startTransition(async () => {
      try {
        const result = await adminCloseCycleWithAdjustments(
          cycleId,
          adjustments.map((a) => ({ productId: a.productId, finalUnitPrice: a.finalUnitPrice })),
        );
        toast.success(
          `Ciclo chiuso. ${result.chargesGenerated} addebiti, ${result.productsAdjusted} rettifiche.`,
        );
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-pm-warm-white shadow-2xl sm:h-[88vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-pm-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-pm-near-black">Rettifica e chiudi</h2>
            <p className="mt-0.5 text-[11px] text-pm-gray">{cycleTitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded-lg px-2 py-1 text-pm-gray hover:bg-black/5"
          >
            ✕
          </button>
        </header>

        <p className="border-b border-pm-border bg-pm-orange-light/40 px-5 py-2 text-[11px] text-pm-gray">
          Modifica il prezzo unitario dei prodotti per cui il peso effettivo
          differisce da quello ordinato. Il totale degli ordini di ogni socio
          verrà ricalcolato e gli addebiti generati con i nuovi prezzi.
        </p>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="py-12 text-center text-[12px] text-pm-gray">Caricamento prodotti…</div>
          ) : rows && rows.length > 0 ? (
            <ul className="space-y-1">
              {rows.map((r) => {
                const meta = [r.variant, r.format].filter(Boolean).join(" · ");
                const editVal = edits[r.productId] ?? "";
                const parsed = parseFloat(editVal.replace(",", "."));
                const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : r.unitPrice;
                const delta = (next - r.unitPrice) * r.totalQty;
                const noOrders = r.totalQty === 0;
                return (
                  <li
                    key={r.productId}
                    className={`rounded-lg border bg-white px-3 py-2.5 ${
                      Math.abs(next - r.unitPrice) > 0.001
                        ? "border-pm-orange/40"
                        : "border-pm-border"
                    } ${noOrders ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[18px] leading-none">
                        {r.emoji || getProductEmoji(r.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-pm-near-black">
                          {r.name}
                        </div>
                        {meta && <div className="text-[11px] text-pm-gray">{meta}</div>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-pm-gray">
                          <span>
                            Ordinato:{" "}
                            <span className="font-mono font-bold text-pm-near-black">
                              {r.totalQty}
                            </span>
                          </span>
                          <span>
                            Tot. attuale:{" "}
                            <span className="font-mono font-bold text-pm-near-black">
                              {formatEur(r.totalAmount)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <label className="block text-[9px] uppercase tracking-wide text-pm-gray-light">
                          € finale
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={editVal}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [r.productId]: e.target.value }))
                          }
                          className="w-[88px] rounded-lg border border-pm-border px-2 py-1.5 text-right text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
                        />
                        {Math.abs(next - r.unitPrice) > 0.001 && (
                          <div
                            className={`mt-1 text-[10px] font-semibold ${
                              delta >= 0 ? "text-pm-orange" : "text-pm-teal"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta.toFixed(2).replace(".", ",")} €
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-12 text-center text-[12px] text-pm-gray">
              Nessun prodotto in questo ciclo.
            </div>
          )}
        </div>

        <footer className="border-t border-pm-border bg-white px-5 py-3.5">
          <div className="mb-3 flex items-end justify-between text-[12px]">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wide text-pm-gray-light">
                Totale ordini
              </div>
              <div className="font-mono text-[15px] font-bold text-pm-near-black">
                {formatEur(newGrandTotal)}
              </div>
            </div>
            {Math.abs(totalDelta) > 0.005 && (
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-wide text-pm-gray-light">
                  Variazione
                </div>
                <div
                  className={`font-mono text-[13px] font-bold ${
                    totalDelta >= 0 ? "text-pm-orange" : "text-pm-teal"
                  }`}
                >
                  {totalDelta >= 0 ? "+" : ""}
                  {totalDelta.toFixed(2).replace(".", ",")} €
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-pm-border bg-white px-4 py-2.5 text-[13px] font-semibold text-pm-gray"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending || loading}
              className="flex-[2] rounded-xl bg-pm-orange px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {isPending
                ? "Chiusura…"
                : adjustments.length > 0
                  ? `Applica ${adjustments.length} rettifica/e e chiudi`
                  : "Chiudi senza rettifiche"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

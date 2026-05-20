"use client";

import { useCallback, useState, useTransition } from "react";
import { adminGetCycleOrderDetails } from "@/lib/actions/admin-cycles";
import { adminUpdateOrderLineActuals } from "@/lib/actions/admin";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { EditClosedOrderModal } from "./edit-closed-order-modal";

type OrderDetail = {
  orderLineId: string;
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
  actualQuantity: string | null;
  actualLineTotal: string | null;
};

type MemberShipping = { memberId: string; memberName: string; amount: number };

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
  const [shipping, setShipping] = useState<MemberShipping[]>([]);
  const [editTarget, setEditTarget] = useState<
    { kind: "edit"; memberId: string; memberName: string } | { kind: "create" } | null
  >(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGetCycleOrderDetails(cycleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setOrderDetails(result.orders || []);
        setShipping(result.shipping || []);
      }
    } catch {
      toast.error("Errore nel caricamento dettagli");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  async function handleOpen() {
    setIsOpen(true);
    await refetch();
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
  const effectiveTotal = (l: OrderDetail) =>
    parseFloat(l.actualLineTotal ?? l.lineTotal);
  const shippingByMember = new Map(shipping.map((s) => [s.memberId, s.amount]));
  const linesTotal = orderDetails.reduce((s, l) => s + effectiveTotal(l), 0);
  const shippingTotal = shipping.reduce((s, m) => s + m.amount, 0);
  const grandTotal = linesTotal + shippingTotal;

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
                const productsTotal = lines.reduce((s, l) => s + effectiveTotal(l), 0);
                const memberId = lines[0]?.memberId;
                const memberShipping = memberId ? shippingByMember.get(memberId) ?? 0 : 0;
                const total = productsTotal + memberShipping;
                return (
                  <div key={memberName} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pm-teal/20 pb-1">
                      <span className="text-[14px] font-bold text-pm-near-black">{memberName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-black text-pm-teal">{formatEur(total)}</span>
                        {memberId && (
                          <button
                            onClick={() =>
                              setEditTarget({ kind: "edit", memberId, memberName })
                            }
                            className="rounded-full bg-pm-orange/10 px-2.5 py-0.5 text-[10px] font-bold text-pm-orange hover:bg-pm-orange/20"
                          >
                            ✎ Modifica
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 pl-2">
                      {lines.map((l) => (
                        <OrderLineRow key={l.orderLineId} line={l} onSaved={refetch} />
                      ))}
                      {memberShipping > 0 && (
                        <div className="flex items-start justify-between gap-3 rounded-lg px-1.5 py-1 text-[12px] text-pm-near-black">
                          <div className="flex min-w-0 flex-1 gap-2">
                            <span className="shrink-0 text-[16px]">🚚</span>
                            <div className="min-w-0">
                              <div className="font-medium">Spedizione</div>
                              <div className="text-[10px] text-pm-gray">
                                Quota fissa per socio
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] font-bold text-pm-near-black">
                            {formatEur(memberShipping)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-pm-border p-4">
          <button
            onClick={() => setEditTarget({ kind: "create" })}
            className="w-full rounded-xl border border-dashed border-pm-orange/40 bg-pm-orange-light py-2 text-[12px] font-bold text-pm-orange hover:bg-pm-orange/15"
          >
            + Aggiungi ordine per un socio
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => downloadSupplierCsv(orderDetails, cycleTitle)}
              disabled={orderDetails.length === 0}
              className="flex-1 rounded-xl border border-pm-teal/30 bg-pm-teal-light py-3 text-[13px] font-bold text-pm-teal active:scale-95 disabled:opacity-50"
            >
              ⬇ CSV fornitore
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-xl bg-pm-near-black py-3 text-[14px] font-bold text-white shadow-lg active:scale-95"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>

      {editTarget && (
        <EditClosedOrderModal
          cycleId={cycleId}
          cycleTitle={cycleTitle}
          mode={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}

// Renders a single order line. Click anywhere on the row to open an inline
// edit form that lets the admin record the *actually delivered* quantity
// and cost (the bietola/800g use case). Saving posts a `correction` ledger
// entry with the delta vs the previous effective total.
function OrderLineRow({ line, onSaved }: { line: OrderDetail; onSaved: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const orderedTotal = parseFloat(line.lineTotal);
  const effective = parseFloat(line.actualLineTotal ?? line.lineTotal);
  const adjusted =
    line.actualQuantity != null || line.actualLineTotal != null;
  const unit = line.unit ?? "";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex w-full items-start justify-between gap-3 rounded-lg px-1.5 py-1 text-left text-[12px] text-pm-near-black hover:bg-pm-orange/5"
        title="Clicca per rettificare la quantita ricevuta"
      >
        <div className="flex min-w-0 flex-1 gap-2">
          <span className="shrink-0 text-[16px]">{line.emoji || getProductEmoji(line.productName)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {line.productName} {line.variant && <span className="text-pm-gray">({line.variant})</span>}
              {adjusted && (
                <span className="ml-1 rounded-full bg-pm-orange/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-pm-orange">
                  rettificato
                </span>
              )}
            </div>
            <div className="truncate text-[10px] text-pm-gray">
              {[line.supplierName ?? line.productSupplier, line.category, line.format].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-right font-mono text-[11px] text-pm-gray">
          {adjusted ? (
            <>
              <span className="block text-pm-gray-light line-through">
                {line.quantity}
                {unit ? ` ${unit}` : ""} = {formatEur(orderedTotal)}
              </span>
              <span className="block font-bold text-pm-near-black">
                {line.actualQuantity != null
                  ? `${parseFloat(line.actualQuantity)
                      .toFixed(3)
                      .replace(/0+$/, "")
                      .replace(/\.$/, "")
                      .replace(".", ",")}${unit ? ` ${unit}` : ""}`
                  : `${line.quantity}${unit ? ` ${unit}` : ""}`}{" "}
                = {formatEur(effective)}
              </span>
            </>
          ) : (
            <>
              {line.quantity}
              {unit ? ` ${unit}` : ""} × {formatEur(parseFloat(line.unitPrice))} = {formatEur(orderedTotal)}
            </>
          )}
        </span>
      </button>
    );
  }

  return (
    <OrderLineEditForm
      line={line}
      isPending={isPending}
      onCancel={() => setEditing(false)}
      onSave={(actualQuantity, actualLineTotal) => {
        startTransition(async () => {
          const result = await adminUpdateOrderLineActuals({
            orderLineId: line.orderLineId,
            actualQuantity,
            actualLineTotal,
          });
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          if (Math.abs(result.correctionAmount) >= 0.005) {
            const dir = result.correctionAmount > 0 ? "rimborso" : "addebito";
            toast.success(`Rettifica salvata: ${dir} di ${formatEur(Math.abs(result.correctionAmount))}`);
          } else {
            toast.success("Rettifica salvata");
          }
          setEditing(false);
          await onSaved();
        });
      }}
    />
  );
}

function OrderLineEditForm({
  line,
  isPending,
  onCancel,
  onSave,
}: {
  line: OrderDetail;
  isPending: boolean;
  onCancel: () => void;
  onSave: (actualQuantity: string | null, actualLineTotal: string | null) => void;
}) {
  const unitPrice = parseFloat(line.unitPrice);
  const initialQty = (line.actualQuantity ?? String(line.quantity)).replace(".", ",");
  const initialTotal = (line.actualLineTotal ?? line.lineTotal).replace(".", ",");
  const [qty, setQty] = useState(initialQty);
  const [total, setTotal] = useState(initialTotal);
  const [totalTouched, setTotalTouched] = useState(false);

  // Keep total auto-derived from qty unless the admin explicitly edits it.
  function onQtyChange(v: string) {
    setQty(v);
    if (totalTouched) return;
    const n = parseFloat(v.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) {
      setTotal((Math.round(n * unitPrice * 100) / 100).toFixed(2).replace(".", ","));
    }
  }

  function handleSave() {
    const qtyNum = parseFloat(qty.replace(",", "."));
    const totalNum = parseFloat(total.replace(",", "."));
    const sameAsOrdered =
      Number.isFinite(qtyNum) &&
      qtyNum === line.quantity &&
      Math.abs(totalNum - parseFloat(line.lineTotal)) < 0.005;
    if (sameAsOrdered) {
      // Reset to "delivered as ordered" — clears any previous correction
      // by passing nulls (the server posts a reverse delta).
      onSave(null, null);
      return;
    }
    onSave(
      Number.isFinite(qtyNum) ? qtyNum.toFixed(3) : null,
      Number.isFinite(totalNum) ? totalNum.toFixed(2) : null,
    );
  }

  const unit = line.unit ?? "";

  return (
    <div className="space-y-2 rounded-lg border border-pm-orange/30 bg-pm-orange-light px-2.5 py-2">
      <div className="flex items-center gap-2 text-[11px] text-pm-near-black">
        <span className="text-[14px]">{line.emoji || getProductEmoji(line.productName)}</span>
        <span className="font-bold">{line.productName}</span>
        <span className="font-mono text-pm-gray">
          ordinato: {line.quantity}{unit ? ` ${unit}` : ""} = {formatEur(parseFloat(line.lineTotal))}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-pm-gray">
          Qta ricevuta{unit ? ` (${unit})` : ""}
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => onQtyChange(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-pm-border bg-white px-2 py-1.5 text-[13px] font-mono text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/40"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-pm-gray">
          Totale (EUR)
          <input
            type="text"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setTotalTouched(true);
            }}
            disabled={isPending}
            className="rounded-md border border-pm-border bg-white px-2 py-1.5 text-[13px] font-mono text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/40"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 rounded-md bg-pm-orange px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
        >
          {isPending ? "Salvataggio…" : "Salva"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-pm-border bg-white px-2 py-1.5 text-[11px] font-bold text-pm-gray"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

// Emits a CSV with one row per (supplier, product, member, quantity) so the
// supplier can prepare each member's bag separately instead of weighing the
// full cycle total and then re-splitting it. Rows are sorted by
// supplier → product → member name so reading the file top-to-bottom matches
// the natural workflow of preparing the delivery.
//
// A blank row separates supplier sections so the file is also easy to scan
// visually. No aggregated subtotal rows: keeping the file uniform (every row
// is a real order line) avoids the risk that a supplier double-counts a
// product by reading both the per-member rows and a subtotal row.
function downloadSupplierCsv(orders: OrderDetail[], cycleTitle: string) {
  if (orders.length === 0) return;

  // Stable supplier label even when the cycle-level supplier and the
  // product-level supplier disagree (legacy free-text field).
  const supplierOf = (l: OrderDetail) => l.supplierName ?? l.productSupplier ?? "—";

  // Sort by supplier → product → member, with variant/format/unit as
  // tiebreakers so two products with the same name but different
  // packaging stay adjacent.
  const rows = [...orders].sort((a, b) => {
    const s = supplierOf(a).localeCompare(supplierOf(b));
    if (s !== 0) return s;
    const p = a.productName.localeCompare(b.productName);
    if (p !== 0) return p;
    const v = (a.variant ?? "").localeCompare(b.variant ?? "");
    if (v !== 0) return v;
    const f = (a.format ?? "").localeCompare(b.format ?? "");
    if (f !== 0) return f;
    return a.memberName.localeCompare(b.memberName);
  });

  // CSV header. Italian labels because the file is meant to be emailed
  // to Italian-speaking suppliers.
  const header = [
    "Fornitore",
    "Prodotto",
    "Varietà",
    "Formato",
    "Unità",
    "Socio",
    "Quantità",
    "Prezzo unitario",
    "Totale (€)",
  ];

  // RFC 4180-ish escaping: wrap in quotes if the value contains a quote,
  // comma, semicolon, or newline; double any embedded quotes.
  const escape = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const join = (cells: Array<string | number | null>) => cells.map(escape).join(";");

  const lines: string[] = [join(header)];
  let currentSupplier = "";

  for (const r of rows) {
    const supplier = supplierOf(r);
    if (supplier !== currentSupplier) {
      if (currentSupplier !== "") lines.push("");
      currentSupplier = supplier;
    }

    const effectiveQty =
      r.actualQuantity != null
        ? parseFloat(r.actualQuantity).toString().replace(".", ",")
        : String(r.quantity);
    const effectiveTotalEur =
      r.actualLineTotal != null
        ? parseFloat(r.actualLineTotal).toFixed(2).replace(".", ",")
        : parseFloat(r.lineTotal).toFixed(2).replace(".", ",");
    lines.push(
      join([
        supplier,
        r.productName,
        r.variant,
        r.format,
        r.unit,
        r.memberName,
        effectiveQty,
        parseFloat(r.unitPrice).toFixed(2).replace(".", ","),
        effectiveTotalEur,
      ]),
    );
  }

  const csv = "﻿" + lines.join("\n"); // BOM so Excel detects UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Sanitize cycle title for the filename: only keep alnum, dash, underscore.
  const safeTitle = cycleTitle.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 60);
  a.download = `ordine_fornitore_${safeTitle || "ciclo"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

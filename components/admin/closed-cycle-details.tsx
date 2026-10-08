"use client";

import { deliveredActuals, deliveredTotalFromQuantity } from "@/lib/closed-order-preview";
import { useCallback, useEffect, useState, useTransition } from "react";
import { adminGetCycleOrderDetails } from "@/lib/actions/admin-cycles";
import { adminUpdateOrderLineActuals } from "@/lib/actions/admin";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { formatDecimalInput, formatNumber } from "@/lib/i18n/format";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EditClosedOrderModal } from "./edit-closed-order-modal";
import { t } from "@/lib/i18n";
import { closedCycleMemberRows, closedCycleMemberTotal } from "@/lib/closed-cycle-totals";

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
  pricePerKg: string | null;
  lineTotal: string;
  actualQuantity: string | null;
  actualLineTotal: string | null;
};

// The legacy "Unità" field is often the literal string "1" — a leftover
// from the import format that has nothing to do with a measurement unit.
// Treat anything that's just "1" (or empty) as no unit so we don't render
// noise like "1 1 × €2,00".
function realUnit(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return u === "" || u === "1" ? "" : u;
}

type MemberShipping = { memberId: string; memberName: string; amount: number };

/**
 * Admin → Ciclo → Ordini, per socio: every member of the cycle with their
 * lines, shipping and fee. On a closed cycle a tap on a line records the
 * delivered weight or price, "✎ Prodotti" edits the whole order and
 * "+ Aggiungi ordine" adds one; an open cycle is read-only (the server
 * refuses corrections until the close).
 */
export function CycleOrdersByMember({
  cycleId,
  cycleTitle,
  editable,
}: {
  cycleId: string;
  cycleTitle: string;
  editable: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [shipping, setShipping] = useState<MemberShipping[]>([]);
  const [handling, setHandling] = useState<MemberShipping[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [editTarget, setEditTarget] = useState<
    { kind: "edit"; memberId: string; memberName: string } | { kind: "create" } | null
  >(null);
  const c = t.admin.closedCycleDetails;

  const refetch = useCallback(async () => {
    try {
      const result = await adminGetCycleOrderDetails(cycleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setOrderDetails(result.orders || []);
        setShipping(result.shipping || []);
        setHandling(result.handling || []);
      }
    } catch {
      toast.error(c.errorLoading);
    } finally {
      setLoading(false);
    }
  }, [cycleId, c.errorLoading]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function toggle(memberId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  // One row per member: those with order lines, then those charged shipping
  // or the fee with no line left.
  const memberRows = closedCycleMemberRows(orderDetails, shipping, handling);
  const effectiveTotal = (l: OrderDetail) => parseFloat(l.actualLineTotal ?? l.lineTotal);
  const q = query.trim().toLowerCase();
  const shown = q ? memberRows.filter((r) => r.memberName.toLowerCase().includes(q)) : memberRows;

  return (
    <div>
      {editable && (
        <div className="border-b border-brand-border px-4 py-3">
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setEditTarget({ kind: "create" })}>
            {c.addOrder}
          </Button>
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-[13px] text-brand-gray">{c.loading}</div>
      ) : memberRows.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-brand-gray">{c.noOrders}</div>
      ) : (
        <>
          <div className="space-y-2 px-4 pt-3">
            <p className="text-label text-brand-gray">{editable ? c.rectifyHint : c.openCycleHint}</p>
            {memberRows.length >= MEMBER_SEARCH_MIN && (
              <>
                <label className="sr-only" htmlFor={`orders-search-${cycleId}`}>
                  {c.searchMember}
                </label>
                <input
                  id={`orders-search-${cycleId}`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={c.searchMember}
                  className="min-h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-[13px] placeholder:text-muted"
                />
              </>
            )}
          </div>
          <ul className="mt-2 divide-y divide-brand-border">
            {shown.map(({ memberId, memberName, lines, shipping: memberShipping, handling: memberHandling }) => {
              const productsTotal = lines.reduce((s, l) => s + effectiveTotal(l), 0);
              const total = closedCycleMemberTotal({
                products: productsTotal,
                shipping: memberShipping,
                handling: memberHandling,
              });
              const open = expanded.has(memberId) || q !== "";
              const adjusted = lines.some((l) => l.actualQuantity != null || l.actualLineTotal != null);
              return (
                <li key={memberId}>
                  <div className="flex items-center gap-2 px-4">
                    <button
                      type="button"
                      onClick={() => toggle(memberId)}
                      aria-expanded={open}
                      className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-brand-near-black">{memberName}</span>
                        <span className="block text-label text-muted">
                          {c.linesCount(lines.length)}
                          {adjusted ? ` · ${c.adjustedBadge}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[13px] font-bold tabular-nums text-brand-near-black">{formatEur(total)}</span>
                        <span aria-hidden className="text-muted">
                          {open ? "▴" : "▾"}
                        </span>
                      </span>
                    </button>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => setEditTarget({ kind: "edit", memberId, memberName })}
                        aria-label={c.editOrderAria(memberName)}
                        className="hit-44 shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-label font-bold text-primary-text hover:bg-primary/20"
                      >
                        {c.editQtyButton}
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="space-y-1 bg-black/[0.02] px-4 pt-1 pb-3">
                      {lines.map((l) => (
                        <OrderLineRow key={l.orderLineId} line={l} editable={editable} onSaved={refetch} />
                      ))}
                      {memberShipping > 0 && (
                        <ExtraRow emoji="🚚" label={c.shippingLine} hint={c.shippingQuota} amount={memberShipping} />
                      )}
                      {memberHandling > 0 && <ExtraRow emoji="🧺" label={t.history.handlingFee} amount={memberHandling} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="py-6 text-center text-[13px] text-brand-gray">{c.noMemberMatch}</p>}
        </>
      )}

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

/** A long cycle gets a search over its members. */
const MEMBER_SEARCH_MIN = 12;

function ExtraRow({ emoji, label, hint, amount }: { emoji: string; label: string; hint?: string; amount: number }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-1.5 py-1 text-[12px] text-brand-near-black">
      <div className="flex min-w-0 flex-1 gap-2">
        <span aria-hidden className="shrink-0 text-[16px]">
          {emoji}
        </span>
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          {hint && <div className="text-label text-brand-gray">{hint}</div>}
        </div>
      </div>
      <span className="shrink-0 font-mono text-label font-bold text-brand-near-black">{formatEur(amount)}</span>
    </div>
  );
}

// Renders a single order line. Click anywhere on the row to open an inline
// edit form that lets the admin record the *actually delivered* quantity
// and cost (the bietola/800g use case). Saving posts a `correction` ledger
// entry with the delta vs the previous effective total.
function OrderLineRow({
  line,
  editable,
  onSaved,
}: {
  line: OrderDetail;
  editable: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const orderedTotal = parseFloat(line.lineTotal);
  const effective = parseFloat(line.actualLineTotal ?? line.lineTotal);
  const adjusted =
    line.actualQuantity != null || line.actualLineTotal != null;
  const unit = realUnit(line.unit);
  const unitSuffix = unit ? ` ${unit}` : "";
  const pricePerKg = line.pricePerKg != null ? parseFloat(line.pricePerKg) : null;

  if (!editing || !editable) {
    // Read-only on an open cycle: a plain row, no edit affordance.
    const RowTag = editable ? "button" : "div";
    return (
      <RowTag
        type={editable ? "button" : undefined}
        onClick={editable ? () => setEditing(true) : undefined}
        className={`group flex w-full items-start justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] text-brand-near-black ${
          editable ? "hover:bg-primary/5" : ""
        }`}
        title={editable ? t.admin.closedCycleDetails.rectifyTitle : undefined}
      >
        <div className="flex min-w-0 flex-1 gap-2">
          <span className="shrink-0 text-[16px]">{line.emoji || getProductEmoji(line.productName)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {line.productName} {line.variant && <span className="text-brand-gray">({line.variant})</span>}
              {adjusted && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-px text-label font-bold uppercase tracking-wide text-primary-text">
                  {t.admin.closedCycleDetails.adjustedBadge}
                </span>
              )}
            </div>
            <div className="truncate text-label text-brand-gray">
              {[line.supplierName ?? line.productSupplier, line.category, line.format].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-right font-mono text-label text-brand-gray">
          {adjusted ? (
            <>
              {/* Original (struck): same `qty × unit_price = total` format
                  as non-rectified rows so the two are visually consistent. */}
              <span className="block text-muted line-through">
                {line.quantity}
                {unitSuffix} × {formatEur(parseFloat(line.unitPrice))} = {formatEur(orderedTotal)}
              </span>
              {/* Effective: derive the actual unit price from
                  effective_total / effective_qty so the breakdown reads
                  cleanly even when actualQuantity differs (e.g. 1 kg
                  ordered → 0,8 kg delivered → 0,800 × €2,00 = €1,60). */}
              {(() => {
                const effQty =
                  line.actualQuantity != null
                    ? parseFloat(line.actualQuantity)
                    : line.quantity;
                const qtyLabel =
                  line.actualQuantity != null
                    ? formatNumber(parseFloat(line.actualQuantity))
                    : String(line.quantity);
                const showBreakdown = effQty > 0;
                const effUnit = showBreakdown ? effective / effQty : null;
                return (
                  <span className="block font-bold text-brand-near-black">
                    {qtyLabel}
                    {unitSuffix}
                    {effUnit != null && (
                      <>
                        {" "}× {formatEur(effUnit)}
                      </>
                    )}{" "}
                    = {formatEur(effective)}
                  </span>
                );
              })()}
            </>
          ) : (
            <>
              <span className="block">
                {line.quantity}
                {unitSuffix} × {formatEur(parseFloat(line.unitPrice))} = {formatEur(orderedTotal)}
              </span>
              {pricePerKg != null && (
                <span className="block text-muted">
                  {formatEur(pricePerKg)}/kg
                </span>
              )}
            </>
          )}
        </span>
        {editable && (
          <span
            aria-hidden
            className="shrink-0 self-center text-[12px] text-muted group-hover:text-primary-text"
          >
            ✎
          </span>
        )}
      </RowTag>
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
            const dir = result.correctionAmount > 0 ? t.admin.closedCycleDetails.refund : t.admin.closedCycleDetails.charge;
            toast.success(t.admin.closedCycleDetails.correctionSavedWithDelta(dir, formatEur(Math.abs(result.correctionAmount))));
          } else {
            toast.success(t.admin.closedCycleDetails.correctionSaved);
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
  const initialQty = formatDecimalInput(line.actualQuantity ?? String(line.quantity));
  const initialTotal = formatDecimalInput(line.actualLineTotal ?? line.lineTotal);
  const [qty, setQty] = useState(initialQty);
  const [total, setTotal] = useState(initialTotal);
  const [totalTouched, setTotalTouched] = useState(false);

  // Keep total auto-derived from qty unless the admin explicitly edits it.
  function onQtyChange(v: string) {
    setQty(v);
    if (totalTouched) return;
    const derived = deliveredTotalFromQuantity(v, line.unitPrice);
    if (derived !== null) setTotal(formatDecimalInput(derived));
  }

  function handleSave() {
    // Back to "delivered as ordered" sends nulls, which clears any previous
    // correction (the server posts a reverse delta).
    const { actualQuantity, actualLineTotal } = deliveredActuals(qty, total, line);
    onSave(actualQuantity, actualLineTotal);
  }

  const unit = realUnit(line.unit);
  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-2">
      <div className="flex items-center gap-2 text-label text-brand-near-black">
        <span className="text-[14px]">{line.emoji || getProductEmoji(line.productName)}</span>
        <span className="font-bold">{line.productName}</span>
        <span className="font-mono text-brand-gray">
          {t.admin.closedCycleDetails.orderedLabel} {line.quantity}{unitSuffix} = {formatEur(parseFloat(line.lineTotal))}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5 text-label font-semibold uppercase tracking-wide text-brand-gray">
          {t.admin.closedCycleDetails.qtyReceived(unit)}
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => onQtyChange(e.target.value)}
            disabled={isPending}
            className="min-h-11 rounded-md border border-brand-border bg-white px-2 py-1.5 text-[14px] font-mono text-brand-near-black"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-label font-semibold uppercase tracking-wide text-brand-gray">
          {t.admin.closedCycleDetails.totalEur}
          <input
            type="text"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setTotalTouched(true);
            }}
            disabled={isPending}
            className="min-h-11 rounded-md border border-brand-border bg-white px-2 py-1.5 text-[14px] font-mono text-brand-near-black"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="min-h-10 flex-1 rounded-md bg-primary px-3 py-1.5 text-[13px] font-bold text-on-primary disabled:opacity-60"
        >
          {isPending ? t.admin.common.saving : t.admin.common.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="min-h-10 rounded-md border border-brand-border bg-white px-3 py-1.5 text-[13px] font-bold text-brand-gray"
        >
          {t.admin.common.cancel}
        </button>
      </div>
    </div>
  );
}


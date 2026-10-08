"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { formatEur, getProductEmoji } from "@/lib/utils";
import {
  adminCloseCycle,
  adminCloseCycleWithAdjustments,
  adminGetCycleProductsForReview,
} from "@/lib/actions/admin";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";

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
  /** Members with an order: the ones the close charges. */
  memberCount: number;
  /** Pay-per-order cycle: adjusted prices are settled later, said in the sheet. */
  perOrder?: boolean;
  /** Extra text for the close (unpaid orders, the fee charged). */
  warning?: string | null;
};

function signedMoney(delta: number): string {
  return delta >= 0 ? `+${formatMoney(delta)}` : `-${formatMoney(-delta)}`;
}

// The one way to close a cycle. The sheet shows what the close does (who is
// charged, the products total, the warnings) and confirms in place. Price
// adjustments, for when the actual weight differs from the ordered one, sit
// behind a toggle so a stray digit cannot reprice every member's lines.
// No adjustment calls adminCloseCycle (audit `close_cycle`); otherwise
// adminCloseCycleWithAdjustments recomputes the lines and closes.
export function CycleReviewCloseButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-on-primary"
      >
        {t.admin.cycleReview.openButton}
      </button>
      {open && <CycleReviewModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function CycleReviewModal({
  cycleId,
  cycleTitle,
  memberCount,
  perOrder,
  warning,
  onClose,
}: Props & { onClose: () => void }) {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminGetCycleProductsForReview(cycleId);
        if (cancelled) return;
        if ("error" in result) {
          setLoadFailed(true);
          return;
        }
        const data = result as ProductRow[];
        setRows(data);
        setEdits(Object.fromEntries(data.map((r) => [r.productId, r.unitPrice.toFixed(2)])));
      } catch {
        if (!cancelled) setLoadFailed(true);
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
    const out: Array<{ productId: string; finalUnitPrice: number }> = [];
    for (const r of rows) {
      const raw = (edits[r.productId] ?? "").replace(",", ".").trim();
      if (!raw) continue;
      const next = parseFloat(raw);
      if (!Number.isFinite(next) || next < 0) continue;
      // Only an actual change counts: no pointless writes, a clean audit log.
      if (Math.abs(next - r.unitPrice) > 0.001) out.push({ productId: r.productId, finalUnitPrice: next });
    }
    return out;
  }, [rows, edits]);

  const newGrandTotal = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, r) => {
      const price = parseFloat((edits[r.productId] ?? "").replace(",", "."));
      const effective = Number.isFinite(price) && price >= 0 ? price : r.unitPrice;
      return sum + effective * r.totalQty;
    }, 0);
  }, [rows, edits]);

  const oldGrandTotal = rows?.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalDelta = newGrandTotal - oldGrandTotal;

  // Leaving with changed prices asks first: the sheet holds unsaved work.
  async function requestClose() {
    if (isPending) return;
    if (adjustments.length > 0) {
      const discard = await confirm({
        title: t.admin.cycleReview.discardTitle,
        message: t.admin.cycleReview.discardMessage,
        confirmLabel: t.admin.cycleReview.discardConfirm,
        cancelLabel: t.admin.cycleReview.keepEditing,
        danger: true,
      });
      if (!discard) return;
    }
    onClose();
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        if (adjustments.length === 0) {
          const result = await adminCloseCycle(cycleId);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success(t.admin.cycle.cycleClosed(result.chargesGenerated));
        } else {
          const result = await adminCloseCycleWithAdjustments(cycleId, adjustments);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success(t.admin.cycleReview.closedSuccess(result.chargesGenerated, result.productsAdjusted));
        }
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  const confirmLabel = isPending
    ? t.admin.cycleReview.closing
    : adjustments.length > 0
      ? t.admin.cycleReview.confirmWithAdjustments(adjustments.length, signedMoney(totalDelta))
      : t.admin.cycleReview.confirmCharge(memberCount);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-brand-warm-white shadow-2xl sm:inset-y-0 sm:my-auto sm:h-fit sm:max-h-[88dvh] sm:rounded-2xl"
          // Esc and a tap outside go through the same "discard?" check.
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            void requestClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            void requestClose();
          }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[16px] font-bold text-brand-near-black">
                {t.admin.cycleReview.modalTitle}
              </Dialog.Title>
              <p className="mt-0.5 text-[13px] text-brand-gray">{cycleTitle}</p>
            </div>
            <button
              onClick={() => void requestClose()}
              aria-label={t.admin.common.close}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-gray hover:bg-black/5"
            >
              <span aria-hidden>✕</span>
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <p className="text-[14px] text-brand-near-black">{t.admin.cycleReview.summary(memberCount)}</p>
            {warning && (
              <div className="whitespace-pre-line rounded-lg border border-primary-mid bg-primary-soft p-3 text-[13px] text-brand-near-black">
                {warning}
              </div>
            )}

            {loading ? (
              <div className="py-10 text-center text-[13px] text-brand-gray">{t.admin.cycleReview.loadingProducts}</div>
            ) : loadFailed || !rows ? (
              <div role="alert" className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[13px] text-brand-red">
                {t.admin.cycleReview.loadFailed}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-brand-gray">{t.admin.cycleReview.noProducts}</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjusting((v) => !v)}
                    aria-expanded={adjusting}
                    className="min-h-11 rounded-xl border border-brand-border bg-white px-4 text-[13px] font-semibold text-brand-near-black"
                  >
                    {adjusting ? t.admin.cycleReview.adjustToggleHide : t.admin.cycleReview.adjustToggle}
                  </button>
                </div>
                {adjusting && (
                  <p className="text-[13px] text-brand-gray">
                    {t.admin.cycleReview.adjustDescription}
                    {perOrder && <> {t.admin.cycleReview.perOrderAdjustNote}</>}
                  </p>
                )}
                <ul className="space-y-1">
                  {rows.map((r) => (
                    <ReviewRow
                      key={r.productId}
                      row={r}
                      adjusting={adjusting}
                      value={edits[r.productId] ?? ""}
                      onChange={(v) => setEdits((prev) => ({ ...prev, [r.productId]: v }))}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          <footer className="border-t border-brand-border bg-white px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
            {rows && rows.length > 0 && (
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="font-mono text-label uppercase tracking-wide text-muted">
                    {t.admin.cycleReview.ordersTotalLabel}
                  </div>
                  <div className="font-mono text-[15px] font-bold text-brand-near-black">{formatEur(newGrandTotal)}</div>
                </div>
                {Math.abs(totalDelta) > 0.005 && (
                  <div className="text-right">
                    <div className="font-mono text-label uppercase tracking-wide text-muted">
                      {t.admin.cycleReview.variationLabel}
                    </div>
                    <div
                      className={`font-mono text-[14px] font-bold ${totalDelta >= 0 ? "text-primary-text" : "text-accent-text"}`}
                    >
                      {signedMoney(totalDelta)}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                onClick={() => void requestClose()}
                className="min-h-12 flex-1 rounded-xl border border-brand-border bg-white px-4 text-[14px] font-semibold text-brand-gray"
              >
                {t.admin.common.cancel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending || loading}
                className="min-h-12 flex-[2] rounded-xl bg-primary px-4 text-[14px] font-bold text-on-primary disabled:opacity-60"
              >
                {confirmLabel}
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviewRow({
  row: r,
  adjusting,
  value,
  onChange,
}: {
  row: ProductRow;
  adjusting: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const meta = [r.variant, r.format].filter(Boolean).join(" · ");
  const parsed = parseFloat(value.replace(",", "."));
  const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : r.unitPrice;
  const changed = Math.abs(next - r.unitPrice) > 0.001;
  const delta = (next - r.unitPrice) * r.totalQty;
  const inputId = `final-price-${r.productId}`;

  return (
    <li
      className={`rounded-lg border bg-white px-3 py-2.5 ${changed ? "border-primary-mid" : "border-brand-border"} ${
        r.totalQty === 0 ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-[18px] leading-none">
          {r.emoji || getProductEmoji(r.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-brand-near-black">{r.name}</div>
          {meta && <div className="text-label text-brand-gray">{meta}</div>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-brand-gray">
            <span>
              {t.admin.cycleReview.orderedLabel}{" "}
              <span className="font-mono font-bold text-brand-near-black">{r.totalQty}</span>
            </span>
            <span>
              {t.admin.cycleReview.currentTotalLabel}{" "}
              <span className="font-mono font-bold text-brand-near-black">{formatEur(r.totalAmount)}</span>
            </span>
          </div>
        </div>
        {adjusting && (
          <div className="shrink-0 text-right">
            <label htmlFor={inputId} className="block text-label text-muted">
              {t.admin.cycleReview.finalPriceLabel}
            </label>
            <input
              id={inputId}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={t.admin.cycleReview.finalPriceAria(r.name)}
              className="mt-0.5 h-11 w-[96px] rounded-lg border border-brand-border px-2 text-right text-[14px] text-brand-near-black focus:border-primary-text"
            />
            {changed && (
              <div className={`mt-1 text-label font-semibold ${delta >= 0 ? "text-primary-text" : "text-accent-text"}`}>
                {signedMoney(delta)}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

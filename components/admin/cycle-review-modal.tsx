"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Sheet, SheetActions } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { formatEur, getProductEmoji } from "@/lib/utils";
import {
  adminCloseCycle,
  adminCloseCycleWithAdjustments,
  adminCloseCycleWithDistinta,
  adminGetCycleProductsForReview,
  adminPreviewDistintaImport,
} from "@/lib/actions/admin";
import type { DistintaImportPreview } from "@/lib/csv/distinta-parser";
import {
  DISTINTA_ACCEPT,
  DistintaPreviewPanel,
  distintaHasChanges,
  distintaTotalDelta,
  readFileAsBase64,
} from "@/components/admin/distinta-preview";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { Input } from "@/components/ui/input";

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
// charged, the products total, the warnings) and confirms in place. Two
// optional corrections sit behind toggles, one at a time, so a stray digit
// cannot reprice every member's lines:
// - price adjustments (adminCloseCycleWithAdjustments recomputes the lines
//   and closes), when one product's price changed for everybody;
// - the supplier sheet with each member's weights (adminCloseCycleWithDistinta
//   closes, then applies it like Fornitore, step 3).
// Neither calls adminCloseCycle (audit `close_cycle`).
export function CycleReviewCloseButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground"
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
  const [mode, setMode] = useState<"none" | "prices" | "distinta">("none");
  const adjusting = mode === "prices";
  const [distintaFile, setDistintaFile] = useState<{ name: string; base64: string } | null>(null);
  const [distintaPreview, setDistintaPreview] = useState<DistintaImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();
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
    if (!rows || mode !== "prices") return [];
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
  }, [rows, edits, mode]);

  const withDistinta = mode === "distinta" && distintaPreview != null && distintaHasChanges(distintaPreview);

  function toggleMode(next: "prices" | "distinta") {
    setMode((m) => (m === next ? "none" : next));
  }

  function onDistintaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDistintaPreview(null);
    setDistintaFile(null);
    // Read and checked at once against the open cycle: nothing is written.
    startPreview(async () => {
      try {
        const base64 = await readFileAsBase64(file);
        setDistintaFile({ name: file.name, base64 });
        const r = await adminPreviewDistintaImport({ cycleId, fileBase64: base64, fileName: file.name, beforeClose: true });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setDistintaPreview(r.preview);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

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
    if (withDistinta) {
      const leave = await confirm({
        title: t.admin.cycleReview.discardDistintaTitle,
        message: t.admin.cycleReview.discardDistintaMessage,
        confirmLabel: t.admin.cycleReview.discardConfirm,
        cancelLabel: t.admin.cycleReview.keepEditing,
        danger: true,
      });
      if (!leave) return;
    } else if (adjustments.length > 0) {
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
        if (withDistinta && distintaFile) {
          const result = await adminCloseCycleWithDistinta({
            cycleId,
            fileBase64: distintaFile.base64,
            fileName: distintaFile.name,
          });
          if ("error" in result) {
            toast.error(result.error);
            // Closed, sheet not applied: the sheet has nothing left to do here.
            if (result.closed) onClose();
            return;
          }
          toast.success(t.admin.cycleReview.closedWithDistintaSuccess(result.chargesGenerated, result.corrections));
        } else if (adjustments.length === 0) {
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
    : withDistinta
      ? t.admin.cycleReview.confirmWithDistinta(signedMoney(distintaTotalDelta(distintaPreview)))
      : adjustments.length > 0
      ? t.admin.cycleReview.confirmWithAdjustments(adjustments.length, signedMoney(totalDelta))
      : t.admin.cycleReview.confirmCharge(memberCount);

  return (
    <Sheet
      // Closing the cycle is left to its buttons: a stray drag must not drop the price adjustments.
      swipeToClose={false}
      open
      onRequestClose={() => void requestClose()}
      title={t.admin.cycleReview.modalTitle}
      subtitle={cycleTitle}
      footer={
        <>
          {rows && rows.length > 0 && mode !== "distinta" && (
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="font-mono text-label uppercase tracking-wide text-muted-foreground">
                  {t.admin.cycleReview.ordersTotalLabel}
                </div>
                <div className="tabular-nums text-[15px] font-bold text-foreground">{formatEur(newGrandTotal)}</div>
              </div>
              {Math.abs(totalDelta) > 0.005 && (
                <div className="text-right">
                  <div className="font-mono text-label uppercase tracking-wide text-muted-foreground">
                    {t.admin.cycleReview.variationLabel}
                  </div>
                  <div
                    className={`tabular-nums text-[14px] font-bold ${totalDelta >= 0 ? "text-primary-text" : "text-accent-text"}`}
                  >
                    {signedMoney(totalDelta)}
                  </div>
                </div>
              )}
            </div>
          )}
          <SheetActions>
            <Button variant="outline" className="flex-1" onClick={() => void requestClose()}>
              {t.admin.common.cancel}
            </Button>
            <Button variant="brand" className="flex-[2]" onClick={handleConfirm} disabled={isPending || loading || previewing || (mode === "distinta" && distintaFile != null && !withDistinta)}>
              {confirmLabel}
            </Button>
          </SheetActions>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[14px] text-foreground">{t.admin.cycleReview.summary(memberCount)}</p>
        {warning && (
          <div className="whitespace-pre-line rounded-lg border border-primary-mid bg-primary-bg p-3 text-[13px] text-foreground">
            {warning}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[13px] text-secondary-foreground">{t.admin.cycleReview.loadingProducts}</div>
        ) : loadFailed || !rows ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-danger-bg p-3 text-[13px] text-destructive">
            {t.admin.cycleReview.loadFailed}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-secondary-foreground">{t.admin.cycleReview.noProducts}</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleMode("prices")}
                aria-expanded={adjusting}
                className="min-h-11 rounded-xl border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
              >
                {adjusting ? t.admin.cycleReview.adjustToggleHide : t.admin.cycleReview.adjustToggle}
              </button>
              <button
                type="button"
                onClick={() => toggleMode("distinta")}
                aria-expanded={mode === "distinta"}
                className="min-h-11 rounded-xl border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
              >
                {mode === "distinta" ? t.admin.cycleReview.distintaToggleHide : t.admin.cycleReview.distintaToggle}
              </button>
            </div>
            {mode === "distinta" && (
              <div className="space-y-3">
                <p className="text-[13px] text-secondary-foreground">
                  {t.admin.cycleReview.distintaDescription}
                  {perOrder && <> {t.admin.cycleReview.perOrderDistintaNote}</>}
                </p>
                <input
                  type="file"
                  aria-label={t.admin.cycleReview.distintaToggle}
                  accept={DISTINTA_ACCEPT}
                  onChange={onDistintaFile}
                  disabled={isPending}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2 text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label file:font-bold file:text-primary-foreground"
                />
                {previewing && (
                  <p role="status" className="text-[13px] text-secondary-foreground">
                    {t.admin.supplierActions.previewing}
                  </p>
                )}
                {distintaPreview && <DistintaPreviewPanel preview={distintaPreview} />}
              </div>
            )}
            {adjusting && (
              <p className="text-[13px] text-secondary-foreground">
                {t.admin.cycleReview.adjustDescription}
                {perOrder && <> {t.admin.cycleReview.perOrderAdjustNote}</>}
              </p>
            )}
            {mode !== "distinta" && (
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
            )}
          </>
        )}
      </div>

    </Sheet>
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
      className={`rounded-lg border bg-card px-3 py-2.5 ${changed ? "border-primary-mid" : "border-border"} ${
        r.totalQty === 0 ? "border-dashed" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-[18px] leading-none">
          {r.emoji || getProductEmoji(r.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-foreground">{r.name}</div>
          {meta && <div className="text-label text-secondary-foreground">{meta}</div>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-secondary-foreground">
            <span>
              {t.admin.cycleReview.orderedLabel}{" "}
              <span className="tabular-nums font-bold text-foreground">{r.totalQty}</span>
            </span>
            <span>
              {t.admin.cycleReview.currentTotalLabel}{" "}
              <span className="tabular-nums font-bold text-foreground">{formatEur(r.totalAmount)}</span>
            </span>
          </div>
        </div>
        {adjusting && (
          <div className="shrink-0 text-right">
            <label htmlFor={inputId} className="block text-label text-muted-foreground">
              {t.admin.cycleReview.finalPriceLabel}
            </label>
            <Input
              id={inputId}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={t.admin.cycleReview.finalPriceAria(r.name)}
              className="mt-0.5 h-11 w-[96px] px-2 text-right focus:border-primary-text"
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

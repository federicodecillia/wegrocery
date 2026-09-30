"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { formatDateTime, formatSignedMoney } from "@/lib/i18n/format";
import { formatEur, getProductEmoji, normalizeCategory } from "@/lib/utils";
import type { SaveOrderLine, SaveOrderResult } from "@/lib/actions/order";
import { discardOrderDraft, loadLastOrderForPrefill, saveOrderDraft } from "@/lib/actions/order";
import type { OrderPaymentResult } from "@/lib/actions/order-payment";
import { draftSyncAction, orderLinesKey, type ResumedDraft } from "@/lib/order-draft";
import { ORDER_PAYMENT_MIN_CENTS, orderPaymentAmount, type HandlingFee } from "@/lib/payments/order-payment";
import { OrderSentDialog } from "./order-sent-dialog";
import { OrderSummary, type ConfirmedLine } from "./order-summary";

type Product = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unit: string | null;
  unitPrice: string;
  pricePerKg: string | null;
  category: string | null;
  sortOrder: number;
};

type OrderLine = {
  productId: string;
  quantity: number;
};

type Props = {
  cycleId: string;
  cycleTitle: string;
  supplierName: string | null;
  orderCloseAt: string | null;
  products: Product[];
  existingLines: OrderLine[];
  // Unconfirmed edits found on the server (order_drafts), or null.
  resumedDraft: ResumedDraft | null;
  balance: number;
  saveAction: (cycleId: string, lines: SaveOrderLine[]) => Promise<SaveOrderResult>;
  // Set on a pay-per-order cycle: the order is confirmed by paying it, and
  // there is no wallet balance to show. Amounts here are for display; the
  // server computes them again.
  payPerOrder?: PayPerOrder;
};

export type PayPerOrder = {
  fee: HandlingFee;
  shipping: { mode: string; fixedCents: number | null };
  // What the member's payments for this cycle already cover.
  coveredCents: number;
  payAction: (cycleId: string, lines: SaveOrderLine[]) => Promise<OrderPaymentResult>;
  cancelAction: (cycleId: string) => Promise<OrderPaymentResult>;
};

// Normalized (see normalizeCategory): grouping keys are case-insensitive.
const CAT_ORDER = ["frutta", "verdura", "insalate"];

// Autosave delay of the draft: long enough to batch a run of taps on "+".
const DRAFT_SAVE_DELAY_MS = 800;

function toLines(quantities: Record<string, number>): SaveOrderLine[] {
  return Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }));
}

function groupByCategory(products: Product[]) {
  // Group case-insensitively so "Verdura" and "verdura" render as one
  // section; the first-seen casing becomes the group label.
  const groups = new Map<string, { label: string; products: Product[] }>();
  for (const p of products) {
    const label = p.category?.trim() || "";
    const key = normalizeCategory(label);
    const group = groups.get(key);
    if (group) group.products.push(p);
    else groups.set(key, { label, products: [p] });
  }
  const keys = Array.from(groups.keys()).sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a) === -1 ? 99 : CAT_ORDER.indexOf(a);
    const bi = CAT_ORDER.indexOf(b) === -1 ? 99 : CAT_ORDER.indexOf(b);
    return ai !== bi ? ai - bi : a.localeCompare(b);
  });
  // If there are other categorized groups, show "Altro" as a header for
  // uncategorized products instead of a silent unlabeled section.
  const hasNamedGroups = keys.some((k) => k !== "");
  return keys.map((k) => ({
    category: k === "" && hasNamedGroups ? "Altro" : groups.get(k)!.label,
    products: groups.get(k)!.products,
  }));
}

export function OrderForm({
  cycleId,
  cycleTitle,
  supplierName,
  orderCloseAt,
  products,
  existingLines,
  resumedDraft,
  balance,
  saveAction,
  payPerOrder,
}: Props) {
  const productMap = new Map(products.map((p) => [p.productId, p]));

  // A product can be pulled from the cycle after someone ordered it; such a
  // line has no price to show, so it never reaches the draft or the recap.
  const savedOnMount = Object.fromEntries(
    existingLines
      .filter((l) => l.quantity > 0 && productMap.has(l.productId))
      .map((l) => [l.productId, l.quantity]),
  );

  const [savedQty, setSavedQty] = useState<Record<string, number>>(savedOnMount);
  // A member coming back to unconfirmed edits finds them.
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    resumedDraft ? Object.fromEntries(resumedDraft.lines.map((l) => [l.productId, l.quantity])) : savedOnMount,
  );
  // Members with an order already in land on the recap; everyone else, and
  // anyone with unconfirmed edits, on the product list.
  const [isEditing, setIsEditing] = useState(resumedDraft !== null || Object.keys(savedOnMount).length === 0);
  const [showDraftBanner, setShowDraftBanner] = useState(resumedDraft !== null);
  const [sent, setSent] = useState<{
    itemCount: number;
    total: number;
    balanceWarning: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const draftKey = orderLinesKey(toLines(draft));
  const savedKey = orderLinesKey(toLines(savedQty));
  // What the server holds for this form, as a key: the draft's, or the
  // confirmed order's when there is no draft. A resumed draft that lost
  // products starts out of sync, so its cleaned version is saved at once.
  const serverKey = useRef(resumedDraft && resumedDraft.dropped === 0 ? draftKey : savedKey);
  // The form as last rendered, for syncDraft: the debounce timer and the
  // leave handlers run after the render that scheduled them.
  const latest = useRef({ draft, draftKey, savedKey });
  useEffect(() => {
    latest.current = { draft, draftKey, savedKey };
  });

  // Brings the server in line with the form (draftSyncAction): saves the
  // draft with saveOrderDraft, drops it once the form is back to the
  // confirmed order, or does nothing.
  const syncDraft = useCallback(() => {
    const { draft: quantities, draftKey: key, savedKey: saved } = latest.current;
    const action = draftSyncAction(key, saved, serverKey.current);
    if (action === "none") return;
    const previous = serverKey.current;
    serverKey.current = key;
    // A failed write leaves the server where it was, so the next edit or the
    // flush on leave tries again (unless a newer sync already went out).
    const retryLater = (err: unknown) => {
      console.error(`[order draft] ${action} failed`, err);
      if (serverKey.current === key) serverKey.current = previous;
    };
    if (action === "discard") {
      discardOrderDraft(cycleId)
        .then((result) => {
          if (!result.ok) retryLater(result.error);
        })
        .catch(retryLater);
      return;
    }
    saveOrderDraft(cycleId, toLines(quantities))
      .then((result) => {
        if (result.ok) return;
        if (result.code === "cycle_not_open") {
          toast.error(result.error);
          router.refresh();
        } else {
          retryLater(result.error);
        }
      })
      .catch(retryLater);
  }, [cycleId, router]);

  // Autosave after a pause in editing. Waits while a confirm, a prefill or a
  // discard is in flight: they settle the server state themselves.
  useEffect(() => {
    if (isPending || draftKey === serverKey.current) return;
    const timer = setTimeout(syncDraft, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftKey, savedKey, isPending, syncDraft]);

  // Leaving before the pause ends (another page, another app, the tab
  // closing) sends at once what the debounce had not sent yet, so the last
  // taps are not lost.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") syncDraft();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", syncDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", syncDraft);
      syncDraft();
    };
  }, [syncDraft]);

  function totalOf(quantities: Record<string, number>) {
    return Object.entries(quantities).reduce((sum, [pid, qty]) => {
      const p = productMap.get(pid);
      return sum + (p ? parseFloat(p.unitPrice) * qty : 0);
    }, 0);
  }

  const orderTotal = totalOf(draft);
  const afterBalance = balance - orderTotal;
  // Pay-per-order: what confirming the draft costs now.
  const payAmount = payPerOrder
    ? orderPaymentAmount({
        productsCents: Math.round(orderTotal * 100),
        shipping: payPerOrder.shipping,
        fee: payPerOrder.fee,
        coveredCents: payPerOrder.coveredCents,
      })
    : null;
  const hasOrder = orderTotal > 0;
  const hasSavedOrder = Object.keys(savedQty).length > 0;

  // Built from the catalogue rather than from savedQty so the recap lists
  // products in the same order as the form above it.
  const confirmedLines: ConfirmedLine[] = products
    .filter((p) => (savedQty[p.productId] ?? 0) > 0)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      meta: [p.variant, p.format].filter(Boolean).join(" · "),
      quantity: savedQty[p.productId],
      unitPrice: parseFloat(p.unitPrice),
    }));
  const savedTotal = totalOf(savedQty);

  function changeQty(productId: string, delta: number) {
    setDraft((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[productId];
      } else {
        updated[productId] = next;
      }
      return updated;
    });
  }

  function handlePrefillFromLast() {
    startTransition(async () => {
      try {
        const result = await loadLastOrderForPrefill(cycleId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        if (result.matched === 0) {
          toast.warning(t.order.noProductsFromLast(result.cycleTitle ?? undefined));
          return;
        }
        // Replace the draft entirely so the user sees exactly what gets
        // re-proposed. They can still tweak before confirming.
        setDraft(result.quantities);
        toast.success(t.order.reproposeSuccess(result.matched, result.cycleTitle || ""));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.order.genericError);
      }
    });
  }

  function persist(quantities: Record<string, number>, isRemoval: boolean) {
    startTransition(async () => {
      try {
        const result = await saveAction(cycleId, toLines(quantities));
        if (!result.success) {
          // Expected refusal (closed cycle, lapsed card, credit limit...):
          // nothing was saved.
          toast.error(result.error);
          // The cycle was closed while the member was editing: refresh so the
          // page reflects the new state (the ordine page will redirect or show
          // "Nessun ordine aperto" instead of the stale form).
          if (result.code === "cycle_not_open") router.refresh();
          return;
        }
        // saveOrder deleted the draft in its batch: the server holds exactly
        // the confirmed order.
        serverKey.current = orderLinesKey(toLines(quantities));
        setShowDraftBanner(false);
        setSavedQty(quantities);
        setDraft(quantities);
        if (isRemoval) {
          setIsEditing(true);
          toast.success(t.order.cancelledSuccess);
        } else {
          setIsEditing(false);
          setSent({
            itemCount: Object.keys(quantities).length,
            total: totalOf(quantities),
            balanceWarning: result.balanceWarning,
          });
        }
        // Invalidate the client Router Cache so navigating back here (or to
        // the home card) can't paint the pre-save order from a stale payload.
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.order.saveError);
      }
    });
  }

  // Pay-per-order: confirm (paying on Stripe when something is due) or cancel
  // (the payments of the cycle are refunded).
  function runPayment(action: () => Promise<OrderPaymentResult>, quantities: Record<string, number>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error") {
          toast.error(result.error);
          if (["cycle_not_open", "changed", "in_progress"].includes(result.code)) router.refresh();
          return;
        }
        if (result.status === "redirect") {
          // The draft is on the server: the member finds it on the way back.
          serverKey.current = orderLinesKey(toLines(quantities));
          toast.message(t.order.pay.redirecting);
          window.location.assign(result.url);
          return;
        }
        serverKey.current = orderLinesKey(toLines(quantities));
        setShowDraftBanner(false);
        setSavedQty(quantities);
        setDraft(quantities);
        if (result.status === "cancelled") {
          setIsEditing(true);
          toast.success(result.refunded ? t.order.pay.cancelled : t.order.pay.cancelledNoRefund);
        } else {
          setIsEditing(false);
          toast.success(t.order.pay.confirmed);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.order.saveError);
      }
    });
  }

  async function handleCancelOrder() {
    if (payPerOrder) {
      const ok = await confirm({
        title: t.order.pay.cancelTitle,
        message:
          payPerOrder.coveredCents > 0
            ? t.order.pay.cancelMessage(formatEur(payPerOrder.coveredCents / 100))
            : t.order.pay.cancelMessageNoRefund,
        confirmLabel: t.order.pay.cancelConfirm,
        cancelLabel: t.common.cancel,
        danger: true,
      });
      if (ok) runPayment(() => payPerOrder.cancelAction(cycleId), {});
      return;
    }
    const ok = await confirm({
      title: t.order.cancelOrderTitle,
      message: t.order.cancelOrderMessage,
      confirmLabel: t.order.cancelOrderConfirm,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (ok) persist({}, true);
  }

  async function handleDiscardDraft() {
    const ok = await confirm({
      title: t.order.discardDraftTitle,
      message: t.order.discardDraftMessage,
      confirmLabel: t.order.discardDraftConfirm,
      cancelLabel: t.common.cancel,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await discardOrderDraft(cycleId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      serverKey.current = savedKey;
      setShowDraftBanner(false);
      setDraft(savedQty);
      setIsEditing(Object.keys(savedQty).length === 0);
      toast.success(t.order.draftDiscarded);
    });
  }

  function handleSave() {
    // Emptying the cart of an order that was already confirmed is a deletion,
    // not a save — it goes through the same confirmation as the recap button.
    if (!hasOrder && hasSavedOrder) {
      void handleCancelOrder();
      return;
    }
    if (payPerOrder) {
      runPayment(() => payPerOrder.payAction(cycleId, toLines(draft)), draft);
      return;
    }
    persist(draft, false);
  }

  const groups = groupByCategory(products);

  return (
    <>
      {/* Cycle header */}
      <div className="mb-1">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
            {t.order.yourOrder}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2.5 py-0.5 font-mono text-label font-semibold text-accent-text">
            <span className="h-1.5 w-1.5 rounded-full bg-accent opacity-75" />
            {t.cycle.open}
          </span>
        </div>
        <p className="font-mono text-label text-brand-gray mt-[3px]">
          {cycleTitle}
          {supplierName ? ` · ${supplierName}` : ""}
          {orderCloseAt ? ` · ${t.cycle.closes(formatDateTime(orderCloseAt))}` : ""}
        </p>
      </div>

      {/* Unconfirmed edits found on arrival (order_drafts). */}
      {isEditing && showDraftBanner && (
        <div className="mt-3 rounded-[14px] border border-primary-mid bg-primary-soft p-[12px_14px]">
          <p className="text-[14px] font-bold text-brand-near-black">{t.order.draftBannerTitle}</p>
          <p className="mt-1 text-[12px] leading-[1.45] text-brand-near-black">{t.order.draftBannerBody}</p>
          {resumedDraft !== null && resumedDraft.dropped > 0 && (
            <p className="mt-1 text-[12px] leading-[1.45] text-primary-text">
              {t.order.draftDropped(resumedDraft.dropped)}
            </p>
          )}
          <button
            type="button"
            onClick={handleDiscardDraft}
            disabled={isPending}
            className="mt-2 text-[12px] font-semibold text-primary-text underline disabled:opacity-50"
          >
            {t.order.discardDraft}
          </button>
        </div>
      )}

      {/* Empty catalog: the cycle is open but the admin hasn't loaded any
          products yet. Same visual as page.tsx's no-open-cycle empty state. */}
      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">📦</span>
          <h2 className="text-[18px] font-bold text-brand-near-black">{t.order.emptyCatalog}</h2>
          <p className="mt-2 text-[14px] text-brand-gray">{t.order.emptyCatalogHint}</p>
        </div>
      )}

      {/* Recap of the order already on file. Replaces the product list until
          the member explicitly chooses to edit it. */}
      {!isEditing && (
        <OrderSummary
          lines={confirmedLines}
          total={savedTotal}
          balanceAfter={balance - savedTotal}
          paidCents={payPerOrder ? payPerOrder.coveredCents : undefined}
          orderCloseAt={orderCloseAt}
          isPending={isPending}
          onEdit={() => setIsEditing(true)}
          onCancel={handleCancelOrder}
        />
      )}

      {/* Way out of edit mode without saving: the confirmed order is still
          on file, so this discards the pending tweaks and shows it again.
          Tweaks are kept as a draft, so dropping them asks first, like
          "Annulla modifiche". */}
      {isEditing && hasSavedOrder && (
        <button
          type="button"
          onClick={async () => {
            if (draftKey !== savedKey) {
              const ok = await confirm({
                title: t.order.discardDraftTitle,
                message: t.order.discardDraftMessage,
                confirmLabel: t.order.discardDraftConfirm,
                cancelLabel: t.common.cancel,
              });
              if (!ok) return;
            }
            setDraft(savedQty);
            setIsEditing(false);
            setShowDraftBanner(false);
          }}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-text"
        >
          ← {t.order.backToOrder}
        </button>
      )}

      {/* "Riproponi ultimo ordine" — visible only when the cart is empty
          so we never silently overwrite an in-progress order. */}
      {isEditing && products.length > 0 && !hasOrder && !hasSavedOrder && (
        <button
          type="button"
          onClick={handlePrefillFromLast}
          disabled={isPending}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-[12px] font-semibold text-accent-text disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v4h4" />
          </svg>
          {t.order.reproposeLastOrder}
        </button>
      )}

      {/* Product list */}
      {isEditing && groups.map(({ category, products: prods }) => (
        <div key={category}>
          {category && (
            <div className="pt-4 pb-2 font-mono text-label uppercase tracking-[0.10em] text-muted">
              {category === "Altro" ? t.order.otherCategory : category}
            </div>
          )}
          {prods.map((p) => {
            const qty = draft[p.productId] ?? 0;
            const meta = [p.variant, p.format].filter(Boolean).join(" · ");
            return (
              <div
                key={p.productId}
                className="flex items-center justify-between border-b border-brand-border py-3 last:border-none"
              >
                <div className="mr-3 flex min-w-0 flex-1 items-start gap-2">
                  <span className="mt-[1px] shrink-0 text-[22px] leading-none">
                    {getProductEmoji(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-brand-near-black">{p.name}</div>
                    <div className="mt-[2px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {meta && <span className="font-mono text-label text-brand-gray">{meta}</span>}
                      <span className="font-mono text-label font-semibold text-primary-text">
                        {formatEur(parseFloat(p.unitPrice))}
                      </span>
                      {p.pricePerKg && (
                        <span className="font-mono text-label text-muted">
                          ({formatEur(parseFloat(p.pricePerKg))}/kg)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {qty === 0 ? (
                  <div className="flex flex-shrink-0 items-center rounded-full bg-black/[0.06] p-0.5">
                    <button
                      onClick={() => changeQty(p.productId, 1)}
                      aria-label={t.order.add}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-light text-brand-gray"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-shrink-0 items-center rounded-full bg-primary-soft p-0.5">
                    <button
                      onClick={() => changeQty(p.productId, -1)}
                      aria-label={t.order.less}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-light text-brand-gray"
                    >
                      −
                    </button>
                    <span className="min-w-[22px] text-center font-mono text-[13px] font-bold text-brand-near-black">
                      {qty}
                    </span>
                    <button
                      onClick={() => changeQty(p.productId, 1)}
                      aria-label={t.order.more}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[18px] font-light text-on-primary"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Sticky footer — rides above the (sticky) bottom nav; from lg the nav
          is in the header, so it sits at the bottom edge. In-flow sticky
          inherits the card width at every breakpoint; -mx-5 bleeds it across
          main's padding to the card edges. */}
      {isEditing && (hasOrder || hasSavedOrder) && (
        <div className="sticky z-10 -mx-5 mt-4 -mb-[calc(var(--spacing-nav-h)+1rem)] bottom-[calc(var(--spacing-nav-h)+env(safe-area-inset-bottom))] lg:-mb-4 lg:bottom-0">
          <div className="border-t border-brand-border bg-brand-warm-white/97 px-5 py-3.5 backdrop-blur-sm">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                  {t.order.totalOrder}
                </div>
                <div className="mt-[2px] text-[24px] font-black tracking-[-0.03em] text-brand-near-black">
                  {formatEur(payAmount ? payAmount.requiredCents / 100 : orderTotal)}
                </div>
              </div>
              {payAmount ? (
                <div className="text-right">
                  <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                    {t.order.pay.toPay}
                  </div>
                  <div className="mt-[2px] font-mono text-[14px] font-bold text-brand-near-black">
                    {payAmount.chargeCents > 0 ? formatEur(payAmount.chargeCents / 100) : t.order.pay.nothingToPay}
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                    {t.order.balanceAfter}
                  </div>
                  <div
                    className={`mt-[2px] font-mono text-[14px] font-bold ${
                      afterBalance < 0 ? "text-brand-red" : "text-accent-text"
                    }`}
                  >
                    {formatSignedMoney(afterBalance)}
                  </div>
                </div>
              )}
            </div>
            {payAmount && hasOrder && (
              <dl className="mb-3 space-y-[2px] text-[12px] text-brand-gray">
                {[
                  [t.order.pay.products, payAmount.productsCents],
                  [t.order.pay.shipping, payAmount.shippingCents],
                  [t.order.pay.fee, payAmount.feeCents],
                  [t.order.pay.alreadyPaid, -payAmount.coveredCents],
                ]
                  .filter(([, c]) => c !== 0)
                  .map(([label, c]) => (
                    <div key={label as string} className="flex justify-between gap-3">
                      <dt>{label}</dt>
                      <dd className="font-mono text-brand-near-black">{formatEur((c as number) / 100)}</dd>
                    </div>
                  ))}
                <p className="pt-[2px] text-muted">
                  {payAmount.outcome === "pay" && payAmount.chargeCents > payAmount.requiredCents - payAmount.coveredCents
                    ? t.order.pay.minimumNote(formatEur(ORDER_PAYMENT_MIN_CENTS / 100))
                    : t.order.pay.feeHint}
                </p>
              </dl>
            )}
            <button
              onClick={handleSave}
              disabled={isPending}
              className={`w-full rounded-full px-[22px] py-[14px] text-sm font-bold transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                hasOrder
                  ? "bg-primary text-on-primary"
                  : "bg-brand-red text-white"
              }`}
            >
              {isPending
                ? t.order.saving
                : !hasOrder
                  ? payPerOrder
                    ? t.order.pay.cancelOrder
                    : t.order.removeOrder
                  : !payAmount
                    ? t.order.confirmOrder
                    : payAmount.chargeCents > 0
                      ? t.order.pay.confirmAndPay(formatEur(payAmount.chargeCents / 100))
                      : t.order.pay.confirm}
            </button>
          </div>
        </div>
      )}

      <OrderSentDialog
        open={sent !== null}
        itemCount={sent?.itemCount ?? 0}
        total={sent?.total ?? 0}
        balanceWarning={sent?.balanceWarning ?? null}
        orderCloseAt={orderCloseAt}
        onClose={() => setSent(null)}
      />
    </>
  );
}

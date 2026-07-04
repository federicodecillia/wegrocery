"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { formatEur, getProductEmoji, normalizeCategory } from "@/lib/utils";
import type { SaveOrderLine } from "@/lib/actions/order";
import { loadLastOrderForPrefill } from "@/lib/actions/order";

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
  orderCloseAt: string | null;
  products: Product[];
  existingLines: OrderLine[];
  balance: number;
  saveAction: (cycleId: string, lines: SaveOrderLine[]) => Promise<{
    success: boolean;
    balanceWarning: string | null;
  }>;
};

// Normalized (see normalizeCategory): grouping keys are case-insensitive.
const CAT_ORDER = ["frutta", "verdura", "insalate"];

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
  orderCloseAt,
  products,
  existingLines,
  balance,
  saveAction,
}: Props) {
  const [draft, setDraft] = useState<Record<string, number>>(
    Object.fromEntries(existingLines.filter((l) => l.quantity > 0).map((l) => [l.productId, l.quantity])),
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const productMap = new Map(products.map((p) => [p.productId, p]));

  const orderTotal = Object.entries(draft).reduce((sum, [pid, qty]) => {
    const p = productMap.get(pid);
    return sum + (p ? parseFloat(p.unitPrice) * qty : 0);
  }, 0);
  const afterBalance = balance - orderTotal;
  const hasOrder = orderTotal > 0;

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

  function handleSave() {
    startTransition(async () => {
      try {
        const lines: SaveOrderLine[] = Object.entries(draft).map(([productId, quantity]) => ({
          productId,
          quantity,
        }));
        const result = await saveAction(cycleId, lines);
        if (result.balanceWarning) {
          toast.warning(result.balanceWarning);
        } else {
          toast.success(t.order.savedSuccess);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t.order.saveError;
        toast.error(message);
        // If the cycle was closed while the user was editing, refresh so the
        // page reflects the new state (the ordine page will redirect or show
        // "Nessun ordine aperto" instead of the stale form).
        if (/ciclo non.*?aperto|ciclo.*?chiuso/i.test(message)) {
          router.refresh();
        }
      }
    });
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/20 bg-brand-teal-light px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal opacity-75" />
            {t.cycle.open}
          </span>
        </div>
        <p className="font-mono text-[10px] text-brand-gray mt-[3px]">
          {cycleTitle}
          {orderCloseAt ? ` · ${t.cycle.closes(formatDateTime(orderCloseAt))}` : ""}
        </p>
      </div>

      {/* "Riproponi ultimo ordine" — visible only when the cart is empty
          so we never silently overwrite an in-progress order. */}
      {!hasOrder && (
        <button
          type="button"
          onClick={handlePrefillFromLast}
          disabled={isPending}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal-light px-4 py-2 text-[12px] font-semibold text-brand-teal disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v4h4" />
          </svg>
          {t.order.reproposeLastOrder}
        </button>
      )}

      {/* Product list */}
      {groups.map(({ category, products: prods }) => (
        <div key={category}>
          {category && (
            <div className="pt-4 pb-2 font-mono text-[9px] uppercase tracking-[0.10em] text-brand-gray-light">
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
                      {meta && <span className="font-mono text-[11px] text-brand-gray">{meta}</span>}
                      <span className="font-mono text-[11px] font-semibold text-brand-orange">
                        {formatEur(parseFloat(p.unitPrice))}
                      </span>
                      {p.pricePerKg && (
                        <span className="font-mono text-[10px] text-brand-gray-light">
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
                  <div className="flex flex-shrink-0 items-center rounded-full bg-brand-orange-light p-0.5">
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
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-[18px] font-light text-white"
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

      {/* Sticky footer — rides above the (sticky) bottom nav. In-flow sticky
          inherits the card width at every breakpoint; -mx-5 bleeds it across
          main's padding to the card edges. */}
      {hasOrder && (
        <div className="sticky z-10 -mx-5 mt-4 -mb-[calc(var(--spacing-nav-h)+1rem)] bottom-[calc(var(--spacing-nav-h)+env(safe-area-inset-bottom))]">
          <div className="border-t border-brand-border bg-brand-warm-white/97 px-5 py-3.5 backdrop-blur-sm">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.09em] text-brand-gray-light">
                  {t.order.totalOrder}
                </div>
                <div className="mt-[2px] text-[24px] font-black tracking-[-0.03em] text-brand-near-black">
                  {formatEur(orderTotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-[0.09em] text-brand-gray-light">
                  {t.order.balanceAfter}
                </div>
                <div
                  className={`mt-[2px] font-mono text-[14px] font-bold ${
                    afterBalance < 0 ? "text-brand-red" : "text-brand-teal"
                  }`}
                >
                  {formatEur(afterBalance)}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="w-full rounded-full bg-brand-orange px-[22px] py-[14px] text-sm font-bold text-white transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? t.order.saving : t.order.confirmOrder}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

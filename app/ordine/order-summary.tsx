"use client";

import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ConfirmedLine = {
  productId: string;
  name: string;
  meta: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  lines: ConfirmedLine[];
  total: number;
  balanceAfter: number;
  orderCloseAt: string | null;
  isPending: boolean;
  onEdit: () => void;
  onCancel: () => void;
};

/** Read-only recap shown when the member already has a saved order for the
 * open cycle. Its job is to make "your order is in" unmistakable on re-entry,
 * while keeping edit and cancel one tap away until the cycle closes. */
export function OrderSummary({
  lines,
  total,
  balanceAfter,
  orderCloseAt,
  isPending,
  onEdit,
  onCancel,
}: Props) {
  return (
    <>
      <div className="mt-4 overflow-hidden rounded-[18px] border border-brand-teal/25 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="flex items-center gap-3 border-b border-brand-border bg-brand-teal-light px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-brand-teal">{t.order.confirmed}</div>
            <div className="mt-[1px] font-mono text-[11px] text-brand-teal/80">
              {t.order.confirmedSummary(lines.length, formatEur(total))}
            </div>
          </div>
        </header>

        <ul className="px-4">
          {lines.map((l) => (
            <li
              key={l.productId}
              className="flex items-center justify-between gap-3 border-b border-brand-border py-2.5 last:border-none"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="text-[18px] leading-none">{getProductEmoji(l.name)}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-brand-near-black">{l.name}</div>
                  <div className="mt-[1px] font-mono text-[10px] text-brand-gray">
                    {l.quantity} × {formatEur(l.unitPrice)}
                    {l.meta ? ` · ${l.meta}` : ""}
                  </div>
                </div>
              </div>
              <span className="shrink-0 font-mono text-[12px] font-bold text-brand-near-black">
                {formatEur(l.quantity * l.unitPrice)}
              </span>
            </li>
          ))}
        </ul>

        <footer className="border-t border-brand-border bg-brand-warm-white px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.09em] text-brand-gray-light">
                {t.order.totalOrder}
              </div>
              <div className="mt-[2px] text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
                {formatEur(total)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.09em] text-brand-gray-light">
                {t.order.balanceAfter}
              </div>
              <div
                className={`mt-[2px] font-mono text-[13px] font-bold ${
                  balanceAfter < 0 ? "text-brand-red" : "text-brand-teal"
                }`}
              >
                {formatEur(balanceAfter)}
              </div>
            </div>
          </div>
        </footer>
      </div>

      <p className="mt-3 text-center text-[12px] leading-[1.5] text-brand-gray">
        {orderCloseAt
          ? t.order.editableUntil(formatDateTime(orderCloseAt))
          : t.order.editableUntilClose}
      </p>

      <div className="mt-3 space-y-2">
        <Button variant="outline" block onClick={onEdit} disabled={isPending}>
          ✎ {t.order.editOrder}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="w-full rounded-full py-2.5 text-[12px] font-semibold text-brand-red transition-opacity hover:bg-brand-red-light disabled:opacity-40"
        >
          {t.order.cancelOrder}
        </button>
      </div>
    </>
  );
}

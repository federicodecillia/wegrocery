"use client";

import { t } from "@/lib/i18n";
import { formatDateTime, formatSignedMoney } from "@/lib/i18n/format";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { paidDifference, type OrderAmount } from "@/lib/payments/order-payment";

export type ConfirmedLine = {
  productId: string;
  name: string;
  meta: string;
  notes: string | null;
  quantity: number;
  unitPrice: number;
};

type Props = {
  lines: ConfirmedLine[];
  total: number;
  balanceAfter: number;
  /** Wallet: the order preparation fee estimate already inside balanceAfter, in cents; 0 = none. */
  feeEstimateCents?: number;
  /** Pay-per-order: what the order costs now and what the member paid for this cycle, shown instead of the balance. */
  payment?: { amount: OrderAmount; paidCents: number };
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
  feeEstimateCents = 0,
  payment,
  orderCloseAt,
  isPending,
  onEdit,
  onCancel,
}: Props) {
  return (
    <>
      <div className="mt-4 overflow-hidden rounded-card border border-accent/25 bg-white shadow-card">
        <header className="flex items-center gap-3 border-b border-brand-border bg-accent-soft px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-accent-text">{t.order.confirmed}</div>
            <div className="mt-[1px] font-mono text-label text-accent-text">
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
                  <div className="text-[14px] font-medium text-brand-near-black">{l.name}</div>
                  <div className="mt-[1px] font-mono text-label text-brand-gray">
                    {l.quantity} × {formatEur(l.unitPrice)}
                    {l.meta ? ` · ${l.meta}` : ""}
                  </div>
                  {l.notes && (
                    <div className="mt-[1px] text-label leading-[1.4] text-muted">{l.notes}</div>
                  )}
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
              <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                {t.order.totalOrder}
              </div>
              <div className="mt-[2px] text-title font-black text-brand-near-black">
                {formatEur(payment ? payment.amount.requiredCents / 100 : total)}
              </div>
            </div>
            {payment ? (
              <div className="text-right">
                <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                  {t.order.pay.alreadyPaid}
                </div>
                <div className="mt-[2px] font-mono text-[13px] font-bold text-accent-text">
                  {formatEur(payment.paidCents / 100)}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="font-mono text-label uppercase tracking-[0.09em] text-muted">
                  {t.order.balanceAfter}
                </div>
                <div
                  className={`mt-[2px] font-mono text-[13px] font-bold ${
                    balanceAfter < 0 ? "text-brand-red" : "text-accent-text"
                  }`}
                >
                  {formatSignedMoney(balanceAfter)}
                </div>
                {feeEstimateCents > 0 && (
                  <div className="mt-[2px] text-label text-muted">{t.order.feeEstimate(formatEur(feeEstimateCents / 100))}</div>
                )}
              </div>
            )}
          </div>
          {payment && <PaymentBreakdown amount={payment.amount} paidCents={payment.paidCents} />}
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

// Pay-per-order: what the total is made of, and what happens to the gap with
// what was paid (usually the member took something out after paying).
function PaymentBreakdown({ amount, paidCents }: { amount: OrderAmount; paidCents: number }) {
  const gap = paidDifference(amount.requiredCents, paidCents);
  const rows: [string, number][] = [
    [t.order.pay.products, amount.productsCents],
    [t.order.pay.shipping, amount.shippingCents],
    [t.order.pay.fee, amount.feeCents],
  ];
  return (
    <div className="mt-3 space-y-[2px] border-t border-brand-border pt-2 text-[12px] text-brand-gray">
      {rows
        .filter(([, c]) => c > 0)
        .map(([label, c]) => (
          <div key={label} className="flex justify-between gap-3">
            <span>{label}</span>
            <span className="font-mono text-brand-near-black">{formatEur(c / 100)}</span>
          </div>
        ))}
      <p className="pt-1 text-brand-near-black">
        {gap?.kind === "refund"
          ? t.order.pay.refundDifference(formatEur(gap.cents / 100))
          : gap?.kind === "due"
            ? t.order.pay.dueDifference(formatEur(gap.cents / 100))
            : t.order.pay.feeHint}
      </p>
    </div>
  );
}


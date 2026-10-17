"use client";

import { Check, Pencil } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatSignedMoney } from "@/lib/i18n/format";
import { formatEur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { paidDifference, type OrderAmount } from "@/lib/payments/order-payment";
import { formatDeadline } from "@/lib/i18n/deadline";

export type ConfirmedLine = {
  productId: string;
  name: string;
  meta: string;
  notes: string | null;
  emoji: string | null;
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
      <div className="mt-4 overflow-hidden rounded-card border border-accent/25 bg-card shadow-card">
        <header className="flex items-center gap-3 border-b border-border bg-accent-bg px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check aria-hidden="true" className="size-4.5" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-accent-text">{t.order.confirmed}</div>
            <div className="mt-0.25 tabular-nums text-label text-accent-text">
              {t.order.confirmedSummary(lines.length, formatEur(total))}
            </div>
          </div>
        </header>

        <ul className="px-4">
          {lines.map((l) => (
            <li
              key={l.productId}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-none"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden="true" className="w-[18px] shrink-0 text-[18px] leading-none">{l.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-foreground">{l.name}</div>
                  <div className="mt-0.25 tabular-nums text-label text-secondary-foreground">
                    {l.quantity} × {formatEur(l.unitPrice)}
                    {l.meta ? ` · ${l.meta}` : ""}
                  </div>
                  {l.notes && (
                    <div className="mt-0.25 text-label leading-[1.4] text-muted-foreground">{l.notes}</div>
                  )}
                </div>
              </div>
              <span className="shrink-0 tabular-nums text-[12px] font-bold text-foreground">
                {formatEur(l.quantity * l.unitPrice)}
              </span>
            </li>
          ))}
        </ul>

        <footer className="border-t border-border bg-background px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-label uppercase tracking-[0.09em] text-muted-foreground">
                {t.order.totalOrder}
              </div>
              <div className="mt-0.5 text-title font-black tabular-nums text-foreground">
                {formatEur(payment ? payment.amount.requiredCents / 100 : total)}
              </div>
            </div>
            {payment ? (
              <div className="text-right">
                <div className="font-mono text-label uppercase tracking-[0.09em] text-muted-foreground">
                  {t.order.pay.alreadyPaid}
                </div>
                <div className="mt-0.5 tabular-nums text-[13px] font-bold text-accent-text">
                  {formatEur(payment.paidCents / 100)}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="font-mono text-label uppercase tracking-[0.09em] text-muted-foreground">
                  {t.order.balanceAfter}
                </div>
                <div
                  className={`mt-0.5 tabular-nums text-[13px] font-bold ${
                    balanceAfter < 0 ? "text-destructive" : "text-accent-text"
                  }`}
                >
                  {formatSignedMoney(balanceAfter)}
                </div>
                {feeEstimateCents > 0 && (
                  <div className="mt-0.5 text-label text-muted-foreground">{t.order.feeEstimate(formatEur(feeEstimateCents / 100))}</div>
                )}
              </div>
            )}
          </div>
          {payment && <PaymentBreakdown amount={payment.amount} paidCents={payment.paidCents} />}
        </footer>
      </div>

      <p className="mt-3 text-center text-[12px] leading-[1.5] text-secondary-foreground">
        {orderCloseAt
          ? t.order.editableUntil(formatDeadline(orderCloseAt))
          : t.order.editableUntilClose}
      </p>

      <div className="mt-3 space-y-2">
        <Button variant="outline" block onClick={onEdit} disabled={isPending}>
          <Pencil aria-hidden className="mr-1.5 size-4" />
          {t.order.editOrder}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="w-full rounded-full py-2.5 text-[12px] font-semibold text-destructive transition-opacity hover:bg-danger-bg disabled:opacity-40"
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
    <div className="mt-3 space-y-0.5 border-t border-border pt-2 text-[12px] text-secondary-foreground">
      {rows
        .filter(([, c]) => c > 0)
        .map(([label, c]) => (
          <div key={label} className="flex justify-between gap-3">
            <span>{label}</span>
            <span className="tabular-nums text-foreground">{formatEur(c / 100)}</span>
          </div>
        ))}
      <p className="pt-1 text-foreground">
        {gap?.kind === "refund"
          ? t.order.pay.refundDifference(formatEur(gap.cents / 100))
          : gap?.kind === "due"
            ? t.order.pay.dueDifference(formatEur(gap.cents / 100))
            : t.order.pay.feeHint}
      </p>
    </div>
  );
}


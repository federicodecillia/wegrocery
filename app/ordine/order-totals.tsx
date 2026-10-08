"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { formatSignedMoney } from "@/lib/i18n/format";
import { ORDER_PAYMENT_MIN_CENTS, type OrderAmount } from "@/lib/payments/order-payment";
import { formatEur } from "@/lib/utils";

type Props = {
  /** Products in the cart, in euros. */
  orderTotal: number;
  /** Pay-per-order: what confirming costs now. Null in wallet mode. */
  payAmount: OrderAmount | null;
  /** Wallet mode: the balance once this order is charged (fee estimate included). */
  afterBalance: number;
  walletFeeCents: number;
  hasOrder: boolean;
  isPending: boolean;
  /** The last refusal of a save (balance, card, closed cycle), cleared on the next edit. */
  error: string | null;
  onConfirm: () => void;
};

// The order page's sticky footer, one row high on a phone: the total and
// what it does to the balance (or what is due) on the left, the action on
// the right; the breakdown opens in a sheet. It only shows amounts the form
// already computed.
//
// It rides above the (sticky) bottom nav; from lg the nav is in the header,
// so it sits at the bottom edge. In-flow sticky inherits the card width at
// every breakpoint; -mx-5 bleeds it across main's padding to the card edges.
// iOS WebKit skips repainting a text change inside this sticky layer and
// leaves the old digits under the new ones: the layer is promoted to its own
// compositing layer (translateZ), the background is opaque (no
// backdrop-filter), and each amount is keyed on its value so a change mounts
// a fresh node, whose old rectangle WebKit does invalidate.
export function OrderTotals({ orderTotal, payAmount, afterBalance, walletFeeCents, hasOrder, isPending, error, onConfirm }: Props) {
  const [details, setDetails] = useState(false);
  const shown = payAmount ? payAmount.requiredCents / 100 : orderTotal;
  const hasDetails = hasOrder && (payAmount !== null || walletFeeCents > 0);

  const label = isPending
    ? t.order.saving
    : !hasOrder
      ? payAmount
        ? t.order.pay.cancelOrder
        : t.order.removeOrder
      : !payAmount
        ? t.order.confirmOrder
        : payAmount.chargeCents > 0
          ? t.order.pay.payAndConfirm
          : t.order.pay.confirm;

  return (
    <div className="sticky z-10 -mx-5 mt-4 -mb-[calc(var(--spacing-nav-h)+1rem)] bottom-[calc(var(--spacing-nav-h)+env(safe-area-inset-bottom))] lg:-mb-4 lg:bottom-0 [transform:translateZ(0)]">
      <div className="border-t border-brand-border bg-brand-warm-white px-5 py-2.5">
        {error && (
          <p className="mb-2 text-[13px] leading-[1.4] text-brand-red">{error}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-brand-gray">{t.order.total}</span>
              <span key={shown} className="text-[20px] font-black tabular-nums tracking-[-0.02em] text-brand-near-black">
                {formatEur(shown)}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
              {payAmount ? (
                <span key={payAmount.chargeCents} className="text-brand-gray">
                  {payAmount.chargeCents > 0
                    ? `${t.order.pay.toPay} ${formatEur(payAmount.chargeCents / 100)}`
                    : t.order.pay.nothingToPay}
                </span>
              ) : (
                <span className="text-brand-gray">
                  {t.order.balanceAfter}{" "}
                  <span
                    key={afterBalance}
                    className={`font-semibold tabular-nums ${afterBalance < 0 ? "text-brand-red" : "text-accent-text"}`}
                  >
                    {formatSignedMoney(afterBalance)}
                  </span>
                </span>
              )}
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="hit-44 font-semibold text-primary-text underline underline-offset-2"
                >
                  {t.order.details}
                </button>
              )}
            </div>
          </div>
          <Button
            variant={hasOrder ? "brand" : "danger"}
            onClick={onConfirm}
            disabled={isPending}
            className="min-h-12 shrink-0 px-5"
          >
            {label}
          </Button>
        </div>
      </div>

      <Sheet open={details} onRequestClose={() => setDetails(false)} title={t.order.detailsTitle} size="sm">
        <dl className="space-y-1 text-[14px] text-brand-gray">
          {(payAmount
            ? [
                [t.order.pay.products, payAmount.productsCents],
                [t.order.pay.shipping, payAmount.shippingCents],
                [t.order.pay.fee, payAmount.feeCents],
                [t.order.pay.alreadyPaid, -payAmount.coveredCents],
              ]
            : [
                [t.order.pay.products, Math.round(orderTotal * 100)],
                [t.order.feeEstimateLabel, walletFeeCents],
              ]
          )
            .filter(([, c]) => c !== 0)
            .map(([label, c]) => (
              <div key={label as string} className="flex justify-between gap-3">
                <dt>{label}</dt>
                <dd className="tabular-nums text-brand-near-black">
                  {(c as number) < 0 ? `−${formatEur(-(c as number) / 100)}` : formatEur((c as number) / 100)}
                </dd>
              </div>
            ))}
          <div className="flex justify-between gap-3 border-t border-brand-border pt-1 font-bold text-brand-near-black">
            <dt>{payAmount ? t.order.pay.toPay : t.order.balanceAfter}</dt>
            <dd className="tabular-nums">
              {payAmount ? formatEur(payAmount.chargeCents / 100) : formatSignedMoney(afterBalance)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-[1.45] text-muted">
          {payAmount
            ? payAmount.outcome === "pay" && payAmount.chargeCents > payAmount.requiredCents - payAmount.coveredCents
              ? t.order.pay.minimumNote(formatEur(ORDER_PAYMENT_MIN_CENTS / 100))
              : t.order.pay.feeHint
            : t.order.feeEstimateHint}
        </p>
      </Sheet>
    </div>
  );
}

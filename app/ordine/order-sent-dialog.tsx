"use client";

import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { formatEur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  itemCount: number;
  total: number;
  /** Non-null when the order pushes the member's balance below zero. */
  balanceWarning: string | null;
  orderCloseAt: string | null;
  onClose: () => void;
};

/** Shown right after a successful save. A toast was too easy to miss on the
 * one action members care about, so the confirmation is a sheet they have to
 * dismiss — and it doubles as the reminder that the order stays editable. */
export function OrderSentDialog({
  open,
  itemCount,
  total,
  balanceWarning,
  orderCloseAt,
  onClose,
}: Props) {
  return (
    <Sheet
      open={open}
      onRequestClose={onClose}
      title={t.order.sentTitle}
      size="sm"
      footer={
        <Button block onClick={onClose} autoFocus>
          {t.order.gotIt}
        </Button>
      }
    >
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p className="font-mono text-[12px] font-semibold text-accent-text">
          {t.order.confirmedSummary(itemCount, formatEur(total))}
        </p>
        <p className="mt-3 text-[14px] leading-[1.5] text-brand-gray">{t.order.sentBody}</p>
        {balanceWarning && (
          <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-[12px] leading-[1.45] text-primary-text">
            {balanceWarning}
          </p>
        )}
        <p className="mt-3 text-label leading-[1.45] text-muted">
          {orderCloseAt ? t.order.editableUntil(formatDateTime(orderCloseAt)) : t.order.editableUntilClose}
        </p>
      </div>
    </Sheet>
  );
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { formatEur } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
 * one action members care about, so the confirmation is a modal they have to
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
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[90%] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-brand-border bg-white p-7 text-center shadow-[0_8px_32px_rgba(45,43,41,0.15)] data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>

          <Dialog.Title className="text-[19px] font-black tracking-[-0.02em] text-brand-near-black">
            {t.order.sentTitle}
          </Dialog.Title>
          <p className="mt-1 font-mono text-[12px] font-semibold text-brand-teal">
            {t.order.confirmedSummary(itemCount, formatEur(total))}
          </p>

          <Dialog.Description className="mt-3 text-[13px] leading-[1.5] text-brand-gray">
            {t.order.sentBody}
          </Dialog.Description>

          {balanceWarning && (
            <p className="mt-3 rounded-xl bg-brand-orange-light px-3 py-2 text-[12px] leading-[1.45] text-brand-orange">
              {balanceWarning}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-[1.45] text-brand-gray-light">
            {orderCloseAt
              ? t.order.editableUntil(formatDateTime(orderCloseAt))
              : t.order.editableUntilClose}
          </p>

          <Button block className="mt-5" onClick={onClose} autoFocus>
            {t.order.gotIt}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

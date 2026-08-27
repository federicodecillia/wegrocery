"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { adminCancelClosedCycle } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/i18n/format";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

// Entry point for cancelling an already-closed cycle (e.g. the supplier
// failed to deliver). Only shown for closed cycles — see tab-ciclo.tsx.
export function CancelCycleButton({ cycleId, cycleTitle }: { cycleId: string; cycleTitle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-red/10 px-3 py-1 text-[11px] font-bold text-brand-red hover:bg-brand-red/20"
      >
        {t.admin.cycleCancel.openButton}
      </button>
      <CancelCycleDialog open={open} onOpenChange={setOpen} cycleId={cycleId} cycleTitle={cycleTitle} />
    </>
  );
}

function CancelCycleDialog({
  open,
  onOpenChange,
  cycleId,
  cycleTitle,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycleId: string;
  cycleTitle: string;
}) {
  const [reason, setReason] = useState("");
  const [refundShipping, setRefundShipping] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error(t.errors.cancelReasonRequired);
      return;
    }
    startTransition(async () => {
      try {
        const result = await adminCancelClosedCycle(cycleId, { refundShipping, reason: trimmedReason });
        toast.success(
          t.admin.cycleCancel.cancelledSuccess(result.refundedMembers, formatMoney(result.totalRefunded)),
        );
        onOpenChange(false);
        setReason("");
        setRefundShipping(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[151] w-[94%] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-[0_8px_32px_rgba(45,43,41,0.15)] data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-center justify-between border-b border-brand-border p-5">
            <div>
              <Dialog.Title className="text-[15px] font-bold text-brand-near-black">
                {t.admin.cycleCancel.modalTitle}
              </Dialog.Title>
              <p className="mt-0.5 text-[11px] text-brand-gray">{cycleTitle}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-brand-border p-2 text-brand-gray hover:bg-brand-gray-light"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 p-5">
            <p className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[12px] text-brand-red">
              {t.admin.cycleCancel.modalDescription}
            </p>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-brand-gray">
                {t.admin.cycleCancel.reasonLabel}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.admin.cycleCancel.reasonPlaceholder}
                rows={3}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
            </div>

            <label className="flex items-center gap-2 text-[12px] font-semibold text-brand-near-black">
              <input
                type="checkbox"
                checked={refundShipping}
                onChange={(e) => setRefundShipping(e.target.checked)}
                className="h-4 w-4 rounded border-brand-border"
              />
              {t.admin.cycleCancel.refundShippingLabel}
            </label>
          </div>

          <div className="flex gap-2 border-t border-brand-border p-5">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-gray"
            >
              {t.admin.common.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending || !reason.trim()}
              className="flex-[2] rounded-xl bg-brand-red px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {isPending ? t.admin.cycleCancel.cancelling : t.admin.cycleCancel.confirmButton}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

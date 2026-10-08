"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetActions } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { confirmDiscard } from "@/components/ui/confirm-dialog";
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
        className="rounded-lg bg-brand-red/10 px-3 py-1 text-label font-bold text-brand-red hover:bg-brand-red/20"
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
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
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

  // A typed reason is unsaved work: closing asks first.
  async function requestClose() {
    if (isPending) return;
    if (reason.trim() && !(await confirmDiscard())) return;
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onRequestClose={() => void requestClose()}
      title={t.admin.cycleCancel.modalTitle}
      subtitle={cycleTitle}
      footer={
        <SheetActions>
          <Button variant="outline" className="flex-1" onClick={() => void requestClose()} disabled={isPending}>
            {t.admin.common.cancel}
          </Button>
          <Button variant="danger" className="flex-[2]" onClick={handleConfirm} disabled={isPending || !reason.trim()}>
            {isPending ? t.admin.cycleCancel.cancelling : t.admin.cycleCancel.confirmButton}
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[13px] text-brand-red">
          {t.admin.cycleCancel.modalDescription}
        </p>

        <div>
          <label htmlFor="cancel-cycle-reason" className="mb-1 block text-label font-semibold text-brand-gray">
            {t.admin.cycleCancel.reasonLabel}
          </label>
          <textarea
            id="cancel-cycle-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.admin.cycleCancel.reasonPlaceholder}
            rows={3}
            className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-[14px] text-brand-near-black"
          />
        </div>

        <label className="flex min-h-11 items-center gap-3 text-[13px] font-semibold text-brand-near-black">
          <input
            type="checkbox"
            checked={refundShipping}
            onChange={(e) => setRefundShipping(e.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-brand-border"
          />
          {t.admin.cycleCancel.refundShippingLabel}
        </label>
      </div>
    </Sheet>
  );
}

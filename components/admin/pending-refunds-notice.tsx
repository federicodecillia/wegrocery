"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminRetryRequestedRefunds } from "@/lib/actions/admin";
import { t } from "@/lib/i18n";

// Shown in Cassa while refunds the app asked for are still waiting for
// Stripe: the app has no scheduler, so an admin sends them again.
export function PendingRefundsNotice({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await adminRetryRequestedRefunds();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.treasury.pendingRefundsResult(result.sent, result.failed, result.waiting));
    });
  }

  return (
    <div className="rounded-xl border border-brand-red/30 bg-brand-red-light p-4">
      <p className="text-[13px] font-bold text-brand-red">{t.admin.treasury.pendingRefundsTitle(count)}</p>
      <p className="mt-1 text-[12px] text-brand-near-black">{t.admin.treasury.pendingRefundsHint}</p>
      <button
        type="button"
        onClick={retry}
        disabled={isPending}
        className="mt-3 rounded-full bg-brand-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
      >
        {isPending ? t.admin.treasury.pendingRefundsRetrying : t.admin.treasury.pendingRefundsRetry}
      </button>
    </div>
  );
}

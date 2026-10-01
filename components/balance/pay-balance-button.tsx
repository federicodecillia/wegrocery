"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { startBalancePayment } from "@/lib/actions/balance-payment";
import { t } from "@/lib/i18n";

// The amount is shown, never sent: the server computes what is due.
export function PayBalanceButton({ amountLabel }: { amountLabel: string }) {
  const [isPending, startTransition] = useTransition();

  function handlePay() {
    startTransition(async () => {
      const result = await startBalancePayment();
      if (result.status === "error") {
        toast.error(result.error);
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={isPending}
      className="flex w-full items-center justify-center rounded-full bg-brand-red px-4 py-[10px] text-[14px] font-bold text-white disabled:opacity-60"
    >
      {isPending ? t.order.pay.redirecting : t.balance.payNow(amountLabel)}
    </button>
  );
}

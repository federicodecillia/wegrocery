"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminChangePaymentMode } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import type { ModeChangeBlocker, ModeChangeState } from "@/lib/payments/mode-change";
import type { PaymentMode } from "@/lib/payments/settings";

// Impostazioni: the group's payment mode, what stops a change, and the
// balances as they are before confirming.
export function PaymentModeCard({
  mode,
  state,
  blockers,
}: {
  mode: PaymentMode;
  state: ModeChangeState;
  blockers: ModeChangeBlocker[];
}) {
  const s = t.admin.settings.mode;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const target: PaymentMode = mode === "wallet" ? "per_order" : "wallet";
  const name = (m: PaymentMode) => (m === "wallet" ? s.walletName : s.perOrderName);

  function handleChange() {
    if (!window.confirm(s.confirm(name(target)))) return;
    startTransition(async () => {
      const result = await adminChangePaymentMode(target);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.changed);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
      <p className="mt-1 text-[12px] font-semibold text-brand-near-black">{s.current(name(mode))}</p>
      <p className="mb-3 mt-1 text-[12px] text-brand-gray">{mode === "wallet" ? s.wallet : s.perOrder}</p>
      {blockers.length > 0 ? (
        <div className="rounded-lg border border-brand-border bg-[#f5f1ec] px-3 py-2 text-[12px] text-brand-near-black">
          <p className="font-semibold">{s.blockedTitle}</p>
          <ul className="mt-1 list-disc pl-4">
            {blockers.map((b) => (
              <li key={b}>{s.blockers[b]}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-brand-gray">
            {s.summary(
              state.negative.count,
              formatMoney(state.negative.cents / 100),
              state.positive.count,
              formatMoney(state.positive.cents / 100),
            )}{" "}
            {target === "per_order" ? s.toPerOrderEffect : s.toWalletEffect}
          </p>
          <button
            type="button"
            onClick={handleChange}
            disabled={isPending}
            className="mt-3 rounded-xl border border-brand-border px-4 py-2 text-[13px] font-bold text-brand-near-black disabled:opacity-60"
          >
            {isPending ? t.admin.common.saving : s.switchTo(name(target))}
          </button>
        </>
      )}
    </section>
  );
}

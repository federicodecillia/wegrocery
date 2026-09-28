"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startOnlineTopup } from "@/lib/actions/topup";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";

type Props = { presetsCents: number[]; minCents: number; maxCents: number };

export function TopupForm({ presetsCents, minCents, maxCents }: Props) {
  const [amount, setAmount] = useState(String(presetsCents[1] / 100));
  const [isPending, startTransition] = useTransition();

  // Only for the button label; the server parses and validates the amount.
  const parsed = Number(amount.trim().replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed * 100 >= minCents && parsed * 100 <= maxCents;

  function handlePay() {
    startTransition(async () => {
      const result = await startOnlineTopup(amount);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {presetsCents.map((cents) => {
          const value = String(cents / 100);
          const selected = amount === value;
          return (
            <button
              key={cents}
              type="button"
              onClick={() => setAmount(value)}
              aria-pressed={selected}
              className={`rounded-[12px] border py-[10px] font-mono text-[15px] font-bold ${
                selected
                  ? "border-brand-orange bg-brand-orange-light text-brand-near-black"
                  : "border-brand-border bg-white text-brand-near-black"
              }`}
            >
              {formatMoney(cents / 100)}
            </button>
          );
        })}
      </div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-brand-gray" htmlFor="topup-amount">
        {t.topup.otherAmount}
      </label>
      <input
        id="topup-amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-1 w-full rounded-[12px] border border-brand-border px-3 py-[10px] font-mono text-[15px]"
      />
      <p className="mb-4 text-[12px] text-brand-gray">
        {t.topup.amountRange(formatMoney(minCents / 100), formatMoney(maxCents / 100))}
      </p>
      <button
        type="button"
        onClick={handlePay}
        disabled={isPending || !valid}
        className="w-full rounded-full bg-brand-orange px-4 py-[12px] text-[14px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.topup.redirecting : valid ? t.topup.payButton(formatMoney(parsed)) : t.topup.payButtonNoAmount}
      </button>
    </div>
  );
}

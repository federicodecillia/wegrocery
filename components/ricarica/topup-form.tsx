"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { startOnlineTopup } from "@/lib/actions/topup";
import { t } from "@/lib/i18n";
import { formatDecimalInput, formatMoney } from "@/lib/i18n/format";
import type { TopupPreset } from "@/lib/payments/config";
import { Input } from "@/components/ui/input";

type Props = { presets: TopupPreset[]; minCents: number; maxCents: number };

// What the member would type: "50" for whole euros, "23,40" otherwise.
function toInput(cents: number): string {
  return formatDecimalInput(cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
}

// Cents of what was typed, NaN when it is not a number. Only for the button
// and the highlighted preset; the server parses and validates the amount.
function toCents(amount: string): number {
  const trimmed = amount.trim();
  return trimmed === "" ? NaN : Math.round(Number(trimmed.replace(",", ".")) * 100);
}

function presetClass(selected: boolean): string {
  return `rounded-xl border py-2.5 tabular-nums text-[15px] font-bold ${
    selected
      ? "border-primary bg-primary-bg text-foreground"
      : "border-border bg-card text-foreground"
  }`;
}

export function TopupForm({ presets, minCents, maxCents }: Props) {
  const debt = presets.find((p) => p.settlesDebt);
  const usual = presets.filter((p) => !p.settlesDebt);
  // The debt when there is one, else 50 € when it fits, else what fits.
  const initialCents =
    debt?.cents ?? usual.find((p) => p.cents === 5000)?.cents ?? usual[0]?.cents ?? maxCents;
  const [amount, setAmount] = useState(toInput(initialCents));
  const [isPending, startTransition] = useTransition();

  const cents = toCents(amount);
  const valid = Number.isFinite(cents) && cents >= minCents && cents <= maxCents;

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
      {debt && (
        <button
          type="button"
          onClick={() => setAmount(toInput(debt.cents))}
          aria-pressed={cents === debt.cents}
          className={`mb-2 w-full ${presetClass(cents === debt.cents)}`}
        >
          {t.topup.settleDebt(formatMoney(debt.cents / 100))}
        </button>
      )}
      {usual.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {usual.map((p) => (
            <button
              key={p.cents}
              type="button"
              onClick={() => setAmount(toInput(p.cents))}
              aria-pressed={cents === p.cents}
              className={presetClass(cents === p.cents)}
            >
              {formatMoney(p.cents / 100)}
            </button>
          ))}
        </div>
      )}
      <label className="mb-1 block font-mono text-label uppercase tracking-[0.1em] text-secondary-foreground" htmlFor="topup-amount">
        {t.topup.otherAmount}
      </label>
      <Input
        id="topup-amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-1 rounded-xl py-2.5 tabular-nums text-[15px]"
      />
      <p className="mb-4 text-[12px] text-secondary-foreground">
        {t.topup.amountRange(formatMoney(minCents / 100), formatMoney(maxCents / 100))}
      </p>
      <button
        type="button"
        onClick={handlePay}
        disabled={isPending || !valid}
        className="w-full rounded-full bg-primary px-4 py-3 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t.topup.redirecting : valid ? t.topup.payButton(formatMoney(cents / 100)) : t.topup.payButtonNoAmount}
      </button>
    </div>
  );
}

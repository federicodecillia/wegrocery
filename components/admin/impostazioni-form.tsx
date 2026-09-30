"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminUpdatePaymentSettings } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import type { PaymentSettingsInput, StripeKeyState } from "@/lib/payments/settings";

const card = "rounded-xl border border-brand-border bg-white p-4 shadow-sm";
const inputCls =
  "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-accent/30";
const labelCls = "mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray";
const helpCls = "mt-1 text-label leading-snug text-brand-gray";

export function PaymentSettingsForm({
  initial,
  stripeKey,
  savedAt,
}: {
  initial: PaymentSettingsInput;
  stripeKey: StripeKeyState;
  // ISO date of the last save; null while the values are the defaults.
  savedAt: string | null;
}) {
  const s = t.admin.settings;
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function update<K extends keyof PaymentSettingsInput>(key: K, value: PaymentSettingsInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adminUpdatePaymentSettings(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {savedAt === null && (
        <p className="rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-[12px] text-brand-near-black">
          {s.defaultsNotice}
        </p>
      )}

      <section className={card}>
        <h3 className="text-[13px] font-bold text-brand-near-black">{s.limitsTitle}</h3>
        <p className="mb-3 mt-1 text-[12px] text-brand-gray">{s.limitsHint}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="settings-overdraft" className={labelCls}>
              {s.overdraftLabel}
            </label>
            <input
              id="settings-overdraft"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.maxOverdraft}
              onChange={(e) => update("maxOverdraft", e.target.value)}
              placeholder={s.noLimit}
              className={inputCls}
            />
            <p className={helpCls}>{s.overdraftHelp}</p>
          </div>
          <div className="min-w-0">
            <label htmlFor="settings-max-balance" className={labelCls}>
              {s.maxBalanceLabel}
            </label>
            <input
              id="settings-max-balance"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.maxBalance}
              onChange={(e) => update("maxBalance", e.target.value)}
              placeholder={s.noLimit}
              className={inputCls}
            />
            <p className={helpCls}>{s.maxBalanceHelp}</p>
          </div>
        </div>
      </section>

      <section className={card}>
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-[13px] font-bold text-brand-near-black">{s.bankTitle}</span>
            <span className="mt-1 block text-[12px] text-brand-gray">{s.bankHint}</span>
          </span>
          <input
            type="checkbox"
            checked={values.bankTransferEnabled}
            onChange={(e) => update("bankTransferEnabled", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
          />
        </label>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="settings-bank-holder" className={labelCls}>
              {s.bankHolderLabel}
            </label>
            <input
              id="settings-bank-holder"
              type="text"
              autoComplete="off"
              value={values.bankHolder}
              onChange={(e) => update("bankHolder", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-bank-iban" className={labelCls}>
              {s.bankIbanLabel}
            </label>
            <input
              id="settings-bank-iban"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={values.bankIban}
              onChange={(e) => update("bankIban", e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
      </section>

      <section className={card}>
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="flex items-center gap-2 text-[13px] font-bold text-brand-near-black">
              {s.onlineTitle}
              {stripeKey.usable && !stripeKey.livemode && (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-label font-semibold text-primary-text">
                  {s.testMode}
                </span>
              )}
            </span>
            <span className="mt-1 block text-[12px] text-brand-gray">{s.onlineHint}</span>
          </span>
          <input
            type="checkbox"
            checked={values.onlinePaymentsEnabled}
            disabled={!stripeKey.usable}
            onChange={(e) => update("onlinePaymentsEnabled", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-accent disabled:opacity-50"
          />
        </label>
        {!stripeKey.usable && (
          <p className="mt-2 rounded-lg bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">
            {s.stripeUnavailable[stripeKey.reason]}
          </p>
        )}
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-on-accent disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.save}
      </button>
      {savedAt && (
        <p className="text-center font-mono text-label text-muted">
          {s.lastSaved(
            formatDateTime(savedAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          )}
        </p>
      )}
    </form>
  );
}

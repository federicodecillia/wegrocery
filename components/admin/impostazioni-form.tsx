"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminUpdatePaymentSettings } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import { BANK_REFERENCE_MAX, fillBankReference } from "@/lib/payments/bank-reference";
import type { PaymentSettingsInput, StripeKeyState } from "@/lib/payments/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const card = "rounded-xl border border-border bg-card p-4";
const helpCls = "mt-1 text-label leading-snug text-secondary-foreground";

// The template as a member would read it, on a sample order closed today.
function referencePreview(template: string): string {
  const now = new Date();
  const sample = t.admin.settings.bankReferenceSample;
  return fillBankReference(template.trim() || t.topup.bankOrderReferenceDefault, {
    order: sample.order,
    month: formatDate(now, { month: "long" }),
    year: formatDate(now, { year: "numeric" }),
    member: sample.member,
  });
}

// One part of the payment settings, each in its own section of Impostazioni
// with its own Save. The form holds every value and saves them all
// (adminUpdatePaymentSettings), but only its part can be edited here.
export function PaymentSettingsForm({
  part,
  initial,
  stripeKey,
  savedAt,
}: {
  part: "limits" | "bank" | "online";
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
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {part === "limits" && (
        <section className={card}>
          <h3 className="text-[13px] font-bold text-foreground">{s.limitsTitle}</h3>
          <p className="mb-3 mt-1 text-[12px] text-secondary-foreground">{s.limitsHint}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label htmlFor="settings-overdraft">
                {s.overdraftLabel}
              </Label>
              <Input
                id="settings-overdraft"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values.maxOverdraft}
                onChange={(e) => update("maxOverdraft", e.target.value)}
                placeholder={s.noLimit}
              />
              <p className={helpCls}>{s.overdraftHelp}</p>
            </div>
            <div className="min-w-0">
              <Label htmlFor="settings-max-balance">
                {s.maxBalanceLabel}
              </Label>
              <Input
                id="settings-max-balance"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values.maxBalance}
                onChange={(e) => update("maxBalance", e.target.value)}
                placeholder={s.noLimit}
              />
              <p className={helpCls}>{s.maxBalanceHelp}</p>
            </div>
          </div>
        </section>
      )}

      {part === "bank" && (
        <section className={card}>
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[13px] font-bold text-foreground">{s.bankTitle}</span>
              <span className="mt-1 block text-[12px] text-secondary-foreground">{s.bankHint}</span>
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
              <Label htmlFor="settings-bank-holder">
                {s.bankHolderLabel}
              </Label>
              <Input
                id="settings-bank-holder"
                type="text"
                autoComplete="off"
                value={values.bankHolder}
                onChange={(e) => update("bankHolder", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="settings-bank-iban">
                {s.bankIbanLabel}
              </Label>
              <Input
                id="settings-bank-iban"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={values.bankIban}
                onChange={(e) => update("bankIban", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="settings-bank-reference">
                {s.bankReferenceLabel}
              </Label>
              <Input
                id="settings-bank-reference"
                type="text"
                autoComplete="off"
                maxLength={BANK_REFERENCE_MAX}
                value={values.bankReferenceTemplate}
                onChange={(e) => update("bankReferenceTemplate", e.target.value)}
                placeholder={t.topup.bankOrderReferenceDefault}
                aria-describedby="settings-bank-reference-help"
              />
              <p id="settings-bank-reference-help" className={helpCls}>
                {s.bankReferenceHelp}
              </p>
              <p className="mt-1 break-words text-[12px] font-medium text-foreground">
                {s.bankReferencePreview(referencePreview(values.bankReferenceTemplate))}
              </p>
            </div>
            <div>
              <Label htmlFor="settings-bank-receipt">
                {s.bankReceiptLabel}
              </Label>
              <Input
                id="settings-bank-receipt"
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={values.bankReceiptEmail}
                onChange={(e) => update("bankReceiptEmail", e.target.value)}
                aria-describedby="settings-bank-receipt-help"
              />
              <p id="settings-bank-receipt-help" className={helpCls}>
                {s.bankReceiptHelp}
              </p>
            </div>
          </div>
        </section>
      )}

      {part === "online" && (
        <section className={card}>
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                {s.onlineTitle}
              </span>
              <span className="mt-1 block text-[12px] text-secondary-foreground">{s.onlineHint}</span>
            </span>
            <input
              type="checkbox"
              checked={values.onlinePaymentsEnabled}
              disabled={!stripeKey.usable}
              onChange={(e) => update("onlinePaymentsEnabled", e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-accent disabled:opacity-50"
            />
          </label>
        </section>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-accent-foreground disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.save}
      </button>
      {savedAt && (
        <p className="text-center tabular-nums text-label text-muted-foreground">
          {s.lastSaved(
            formatDateTime(savedAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          )}
        </p>
      )}
    </form>
  );
}

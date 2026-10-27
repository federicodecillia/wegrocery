"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { labelClass } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { adminSetNewCycleDefaults, adminSetNewCyclePayment } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";
import { formatHandlingFee, formatMoney } from "@/lib/i18n/format";
import {
  HANDLING_FEE_MAX,
  WEIGHING_DEPOSIT_MAX,
  WEIGHING_DEPOSIT_SUGGESTED,
  type HandlingFee,
} from "@/lib/payments/order-payment";
import type {
  ModeDefaults,
  ModeDefaultsInput,
  NewCycleDefaults,
  NewCyclePaymentChoice,
} from "@/lib/payments/new-cycle-defaults";
import type { PaymentMode } from "@/lib/payments/settings";

const CHOICES: NewCyclePaymentChoice[] = ["wallet_only", "wallet_default", "card_default"];
// The order the preview is worked out on, in euros.
const SAMPLE_ORDER = 50;

// The fee shows what "Nuovo ciclo" starts from today: the default, else the
// last one of that mode (10% by card), so saving never changes it unseen.
function toInput(d: ModeDefaults | undefined, mode: PaymentMode, startFee: HandlingFee | null): ModeDefaultsInput {
  const fee = d?.fee ?? startFee ?? undefined;
  // "None": stored as such for the wallet, as 0% for a card cycle (NO_HANDLING_FEE).
  const noFee = fee !== undefined && (fee.type === "none" || (mode === "per_order" && fee.value === 0));
  return {
    shippingMode: d?.shipping?.mode ?? "fixed_per_member",
    shippingAmount: d?.shipping?.amount == null ? "" : String(d.shipping.amount),
    feeType: noFee ? "none" : fee ? fee.type : mode === "wallet" ? "none" : "percent",
    feeValue: fee && !noFee ? String(fee.value) : "",
    ...(mode === "per_order" && { depositPct: d?.depositPct ? String(d.depositPct) : "" }),
  };
}

function amountOf(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() === "" || !Number.isFinite(n) ? null : n;
}

// What a sample order pays with these defaults, as the admin types them.
function previewOf(v: ModeDefaultsInput): string {
  const s = t.admin.settings.newCycles;
  const shippingAmount = amountOf(v.shippingAmount);
  const shipping =
    v.shippingMode === "proportional" ? s.shippingShared : shippingAmount === null ? s.notSet : formatMoney(shippingAmount);
  const feeValue = amountOf(v.feeValue);
  const fee =
    v.feeType === "none"
      ? formatMoney(0)
      : feeValue === null
        ? s.notSet
        : `${formatMoney(v.feeType === "percent" ? (SAMPLE_ORDER * feeValue) / 100 : feeValue)}${
            v.feeType === "percent" ? ` (${formatHandlingFee({ type: "percent", value: feeValue })})` : ""
          }`;
  return s.preview(formatMoney(SAMPLE_ORDER), shipping, fee);
}

// An amount field with its unit inside, on the same row as its choice.
function UnitInput({ unit, ...props }: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative w-28 shrink-0">
      <Input type="text" inputMode="decimal" autoComplete="off" className="pr-8 text-right tabular-nums" {...props} />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

// One mode's defaults, compact: each cost is a choice and an amount on one row.
function ModeDefaultsFields({
  mode,
  value,
  onChange,
}: {
  mode: PaymentMode;
  value: ModeDefaultsInput;
  onChange: (v: ModeDefaultsInput) => void;
}) {
  const s = t.admin.settings.newCycles;
  const c = t.admin.cycle;
  const id = (name: string) => `new-cycle-${mode}-${name}`;
  const feeOptions: { v: ModeDefaultsInput["feeType"]; label: string }[] = [
    { v: "none", label: c.handlingFeeNone },
    { v: "percent", label: c.handlingFeePercent },
    { v: "fixed", label: c.handlingFeeFixed },
  ];
  const proportional = value.shippingMode === "proportional";
  // Kept apart from the amount, so clearing the field does not switch it off.
  const [depositOn, setDepositOn] = useState((value.depositPct ?? "") !== "");
  return (
    <fieldset className="min-w-0 rounded-lg border border-border p-3">
      <legend className="px-1 text-[12px] font-bold text-foreground">
        {mode === "wallet" ? s.walletColumn : s.cardColumn}
      </legend>
      <label htmlFor={id("shipping-mode")} className={labelClass}>
        {c.shippingLabel}
      </label>
      <div className="flex gap-2">
        <NativeSelect
          id={id("shipping-mode")}
          wrapperClassName="min-w-0 flex-1"
          value={value.shippingMode}
          onChange={(e) => onChange({ ...value, shippingMode: e.target.value as ModeDefaultsInput["shippingMode"] })}
        >
          <NativeSelectOption value="fixed_per_member">{c.shippingFixed}</NativeSelectOption>
          <NativeSelectOption value="proportional">{c.shippingProportional}</NativeSelectOption>
        </NativeSelect>
        <UnitInput
          id={id("shipping")}
          unit="€"
          aria-label={`${c.shippingLabel}, ${proportional ? s.shippingTotal : s.shippingPerMember}`}
          value={value.shippingAmount}
          onChange={(e) => onChange({ ...value, shippingAmount: e.target.value })}
          placeholder="0,00"
        />
      </div>

      <label htmlFor={id("fee-type")} className={`${labelClass} mt-3`}>
        {c.handlingFeeLabel}
      </label>
      <div className="flex gap-2">
        <NativeSelect
          id={id("fee-type")}
          wrapperClassName="min-w-0 flex-1"
          value={value.feeType}
          onChange={(e) => onChange({ ...value, feeType: e.target.value as ModeDefaultsInput["feeType"] })}
        >
          {feeOptions.map((opt) => (
            <NativeSelectOption key={opt.v} value={opt.v}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {value.feeType !== "none" && (
          <UnitInput
            id={id("fee")}
            unit={value.feeType === "percent" ? "%" : "€"}
            aria-label={`${c.handlingFeeLabel}, ${
              value.feeType === "percent" ? `% (max ${HANDLING_FEE_MAX.percent})` : `€ (max ${HANDLING_FEE_MAX.fixed})`
            }`}
            value={value.feeValue}
            onChange={(e) => onChange({ ...value, feeValue: e.target.value })}
          />
        )}
      </div>
      {value.feeType !== "none" && value.feeValue.trim() === "" && (
        <p className="mt-1 text-label text-muted-foreground">{s.feeEmpty}</p>
      )}

      {mode === "per_order" && (
        <>
          <label htmlFor={id("deposit-type")} className={`${labelClass} mt-3`}>
            {c.weighingDepositLabel}
          </label>
          <div className="flex gap-2">
            <NativeSelect
              id={id("deposit-type")}
              wrapperClassName="min-w-0 flex-1"
              value={depositOn ? "percent" : "none"}
              onChange={(e) => {
                const on = e.target.value === "percent";
                setDepositOn(on);
                onChange({ ...value, depositPct: on ? String(WEIGHING_DEPOSIT_SUGGESTED) : "" });
              }}
            >
              <NativeSelectOption value="none">{c.handlingFeeNone}</NativeSelectOption>
              <NativeSelectOption value="percent">{c.handlingFeePercent}</NativeSelectOption>
            </NativeSelect>
            {depositOn && (
              <UnitInput
                id={id("deposit")}
                unit="%"
                aria-label={`${c.weighingDepositLabel}, % (max ${WEIGHING_DEPOSIT_MAX})`}
                value={value.depositPct ?? ""}
                onChange={(e) => onChange({ ...value, depositPct: e.target.value })}
              />
            )}
          </div>
          <p className="mt-1 text-label text-muted-foreground">{c.weighingDepositHint}</p>
        </>
      )}
      <p className="mt-3 text-[12px] text-secondary-foreground">{previewOf(value)}</p>
    </fieldset>
  );
}

// Impostazioni -> Nuovi cicli: how new cycles are paid and the costs "Nuovo
// ciclo" starts from, per payment mode (lib/payments/new-cycle-defaults.ts).
// Cycles already created never change. The id keeps the "#cicli-carta" link
// of the cycle form working.
export function NewCyclesCard({
  groupMode,
  cardAvailable,
  stripeMissing,
  choice: initialChoice,
  defaults,
  startFees,
}: {
  groupMode: PaymentMode;
  /** Card cycles possible in this wallet group (Stripe usable, euro). */
  cardAvailable: boolean;
  /** Only Stripe is missing for card cycles: say where to connect it. */
  stripeMissing: boolean;
  choice: NewCyclePaymentChoice;
  defaults: NewCycleDefaults;
  /** The fee each mode starts from without a default (lib/payments/new-cycle-defaults.ts, startingFee). */
  startFees: Record<PaymentMode, HandlingFee | null>;
}) {
  const s = t.admin.settings.newCycles;
  const [choice, setChoice] = useState(initialChoice);
  const [values, setValues] = useState<Record<PaymentMode, ModeDefaultsInput>>({
    wallet: toInput(defaults.wallet, "wallet", startFees.wallet),
    per_order: toInput(defaults.per_order, "per_order", startFees.per_order),
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const modes: PaymentMode[] =
    groupMode === "per_order"
      ? ["per_order"]
      : cardAvailable && choice !== "wallet_only"
        ? choice === "card_default"
          ? ["per_order", "wallet"]
          : ["wallet", "per_order"]
        : ["wallet"];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      if (groupMode === "wallet" && choice !== initialChoice) {
        const result = await adminSetNewCyclePayment(choice);
        if (result.error) {
          toast.error(result.error);
          return;
        }
      }
      const input: Partial<Record<PaymentMode, ModeDefaultsInput>> = {};
      for (const m of modes) input[m] = values[m];
      const result = await adminSetNewCycleDefaults(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <form id="cicli-carta" onSubmit={handleSubmit} noValidate className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">{s.title}</h3>
      <p className="mt-1 text-[12px] text-secondary-foreground">{s.hint}</p>

      {groupMode === "per_order" ? (
        <p className="mt-3 text-[12px] text-foreground">{s.perOrderGroup}</p>
      ) : cardAvailable ? (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">{s.title}</legend>
          {CHOICES.map((c) => (
            <label
              key={c}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                choice === c ? "border-primary bg-primary-bg" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="new-cycle-payment"
                value={c}
                checked={choice === c}
                onChange={() => setChoice(c)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">{s.choices[c].label}</span>
                <span className="mt-0.5 block text-[12px] text-secondary-foreground">{s.choices[c].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="mt-3 text-[12px] text-foreground">
          {s.walletOnly}
          {stripeMissing && <span className="block text-secondary-foreground">{s.needStripe}</span>}
        </p>
      )}

      <h4 className="mt-4 text-[13px] font-bold text-foreground">{s.defaultsTitle}</h4>
      <p className="mt-1 text-[12px] text-secondary-foreground">{s.defaultsHint}</p>
      <div className={`mt-3 grid gap-3 ${modes.length > 1 ? "md:grid-cols-2" : ""}`}>
        {modes.map((m) => (
          <ModeDefaultsFields
            key={m}
            mode={m}
            value={values[m]}
            onChange={(v) => setValues((prev) => ({ ...prev, [m]: v }))}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-accent-foreground disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.save}
      </button>
    </form>
  );
}

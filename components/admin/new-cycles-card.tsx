"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { labelClass } from "@/components/ui/label";
import { adminSetNewCycleDefaults, adminSetNewCyclePayment } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";
import { formatHandlingFee, formatMoney } from "@/lib/i18n/format";
import { HANDLING_FEE_MAX, type HandlingFee } from "@/lib/payments/order-payment";
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

const segmentCls = (active: boolean) =>
  `flex-1 rounded-md py-1.5 text-label font-semibold transition-colors ${
    active ? "bg-card text-foreground shadow-sm" : "bg-transparent text-secondary-foreground"
  }`;

// The fee shows what "Nuovo ciclo" starts from today: the default, else the
// last one of that mode (10% by card), so saving never changes it unseen.
function toInput(d: ModeDefaults | undefined, mode: PaymentMode, startFee: HandlingFee | null): ModeDefaultsInput {
  const fee = d?.fee ?? startFee ?? undefined;
  return {
    shippingMode: d?.shipping?.mode ?? "fixed_per_member",
    shippingAmount: d?.shipping?.amount == null ? "" : String(d.shipping.amount),
    // A card cycle always has a fee: "none" only for the wallet.
    feeType: fee ? fee.type : mode === "wallet" ? "none" : "percent",
    feeValue: fee && fee.type !== "none" ? String(fee.value) : "",
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
    ...(mode === "wallet" ? [{ v: "none" as const, label: c.handlingFeeNone }] : []),
    { v: "percent", label: c.handlingFeePercent },
    { v: "fixed", label: c.handlingFeeFixed },
  ];
  return (
    <fieldset className="min-w-0 rounded-lg border border-border p-3">
      <legend className="px-1 text-[12px] font-bold text-foreground">
        {mode === "wallet" ? s.walletColumn : s.cardColumn}
      </legend>
      <p className={labelClass} id={id("shipping-label")}>
        {c.shippingLabel}
      </p>
      <div className="mb-2 flex rounded-lg bg-tint/[0.05] p-0.5" role="group" aria-labelledby={id("shipping-label")}>
        {(
          [
            { v: "fixed_per_member", label: c.shippingFixed },
            { v: "proportional", label: c.shippingProportional },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            aria-pressed={value.shippingMode === opt.v}
            onClick={() => onChange({ ...value, shippingMode: opt.v })}
            className={segmentCls(value.shippingMode === opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Input
        id={id("shipping")}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-labelledby={id("shipping-label")}
        aria-describedby={id("shipping-unit")}
        value={value.shippingAmount}
        onChange={(e) => onChange({ ...value, shippingAmount: e.target.value })}
        placeholder="0,00"
      />
      <p id={id("shipping-unit")} className="mt-1 text-label text-muted-foreground">
        {value.shippingMode === "proportional" ? s.shippingTotal : s.shippingPerMember}
      </p>

      <p className={`${labelClass} mt-3`} id={id("fee-label")}>
        {c.handlingFeeLabel}
      </p>
      <div className="mb-2 flex rounded-lg bg-tint/[0.05] p-0.5" role="group" aria-labelledby={id("fee-label")}>
        {feeOptions.map((opt) => (
          <button
            key={opt.v}
            type="button"
            aria-pressed={value.feeType === opt.v}
            onClick={() => onChange({ ...value, feeType: opt.v })}
            className={segmentCls(value.feeType === opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value.feeType !== "none" && (
        <>
          <Input
            id={id("fee")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-labelledby={id("fee-label")}
            aria-describedby={id("fee-help")}
            value={value.feeValue}
            onChange={(e) => onChange({ ...value, feeValue: e.target.value })}
            placeholder={value.feeType === "percent" ? "%" : "€"}
          />
          <p id={id("fee-help")} className="mt-1 text-label text-muted-foreground">
            {value.feeType === "percent" ? `% (max ${HANDLING_FEE_MAX.percent})` : `€ (max ${HANDLING_FEE_MAX.fixed})`}
            {" · "}
            {s.feeEmpty}
          </p>
        </>
      )}
      <p className="mt-3 text-[12px] font-medium text-foreground">{previewOf(value)}</p>
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

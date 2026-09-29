"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminRecordTopup, type CassaMovementResult } from "@/lib/actions/admin";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";
import { MANUAL_PAYMENT_METHODS, parseAmountInput, type ManualPaymentMethod } from "@/lib/ledger";
import { formatDate } from "@/lib/utils";
import { MemberCombobox, type PickerMember } from "./member-combobox";

const inputCls =
  "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-teal/30";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-gray";

function todayInput(): string {
  return utcToZonedLocalInput(new Date()).slice(0, 10);
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function MethodSelect({
  value,
  onChange,
  id,
}: {
  value: ManualPaymentMethod;
  onChange: (method: ManualPaymentMethod) => void;
  id: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ManualPaymentMethod)}
      className={`${inputCls} bg-white`}
    >
      {MANUAL_PAYMENT_METHODS.map((m) => (
        <option key={m} value={m}>
          {t.admin.treasury.methods[m]}
        </option>
      ))}
    </select>
  );
}

export type RecapLine = { label: string; value: string };

type Review = { warning: string | null; error: string | null };

// The recap shown before anything is written. `onConfirm(true)` resubmits
// after a possible-duplicate warning.
function Recap({
  title,
  lines,
  review,
  confirmLabel,
  isPending,
  onBack,
  onConfirm,
}: {
  title: string;
  lines: RecapLine[];
  review: Review;
  confirmLabel: string;
  isPending: boolean;
  onBack: () => void;
  onConfirm: (confirmDuplicate: boolean) => void;
}) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div>
      <p ref={headingRef} tabIndex={-1} className="mb-3 text-[13px] font-bold text-brand-near-black focus:outline-none">
        {title}
      </p>
      <dl className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-gray">{line.label}</dt>
            <dd className="min-w-0 break-words text-right text-[13px] text-brand-near-black">{line.value}</dd>
          </div>
        ))}
      </dl>
      {review.warning && (
        <p role="alert" className="mt-3 rounded-lg border border-brand-orange/40 bg-brand-orange-light px-3 py-2 text-[12px] text-brand-near-black">
          {review.warning}
        </p>
      )}
      {review.error && (
        <p role="alert" className="mt-3 rounded-lg border border-brand-red/30 bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">
          {review.error}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="rounded-xl border border-brand-border py-2 text-[13px] font-semibold text-brand-near-black disabled:opacity-60"
        >
          {t.admin.treasury.backToEdit}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(review.warning !== null)}
          disabled={isPending}
          className="rounded-xl bg-brand-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {isPending
            ? t.admin.treasury.registeringTopup
            : review.warning
              ? t.admin.treasury.recordAnyway
              : confirmLabel}
        </button>
      </div>
    </div>
  );
}

// Runs a Cassa action from the recap: an error or a duplicate warning keeps
// the recap open with the message, a success resets the form.
function useMovementSubmit(onRecorded: (memberName: string) => void) {
  const [isPending, startTransition] = useTransition();
  const [review, setReview] = useState<Review | null>(null);

  function submit(action: () => Promise<CassaMovementResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setReview({ warning: null, error: result.error });
      } else if (result.warning) {
        setReview({ warning: result.warning, error: null });
      } else {
        setReview(null);
        onRecorded(result.memberName ?? "");
      }
    });
  }

  return { isPending, review, setReview, submit };
}

// ── Top-up ────────────────────────────────────────────────────────────────────

export function TopupForm({ members }: { members: PickerMember[] }) {
  const [member, setMember] = useState<PickerMember | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("bonifico");
  const [externalRef, setExternalRef] = useState("");
  const [entryDate, setEntryDate] = useState(todayInput);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const parsedAmount = parseAmountInput(amount);
  const { isPending, review, setReview, submit } = useMovementSubmit((memberName) => {
    toast.success(t.admin.treasury.topupRegistered(formatMoney(parsedAmount), memberName));
    setMember(null);
    setAmount("");
    setMethod("bonifico");
    setExternalRef("");
    setEntryDate(todayInput());
    setNote("");
  });

  function handleReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member || !(Math.round(parsedAmount * 100) > 0)) {
      setFormError(t.admin.treasury.invalidTopup);
      return;
    }
    setFormError(null);
    setReview({ warning: null, error: null });
  }

  function confirm(confirmDuplicate: boolean) {
    if (!member) return;
    submit(() =>
      adminRecordTopup({
        memberId: member.memberId,
        amount: parsedAmount,
        method,
        externalRef,
        note,
        entryDate,
        confirmDuplicate,
      }),
    );
  }

  const card = "rounded-xl border border-brand-border bg-white p-4 shadow-sm";

  if (review && member) {
    const lines: RecapLine[] = [
      { label: t.admin.treasury.recapMember, value: `${member.fullName} (${member.email})` },
      { label: t.admin.treasury.recapAmount, value: `+${formatMoney(parsedAmount)}` },
      { label: t.admin.treasury.recapMethod, value: t.admin.treasury.methods[method] },
      ...(externalRef.trim() ? [{ label: t.admin.treasury.recapRef, value: externalRef.trim() }] : []),
      { label: t.admin.treasury.recapDate, value: entryDate ? formatDate(entryDate) : formatDate(new Date()) },
      ...(note.trim() ? [{ label: t.admin.treasury.recapNote, value: note.trim() }] : []),
      {
        label: t.admin.treasury.recapBalance,
        value: `${formatMoney(member.balance)} → ${formatMoney(member.balance + parsedAmount)}`,
      },
    ];
    return (
      <div className={card}>
        <Recap
          title={t.admin.treasury.recapTitle}
          lines={lines}
          review={review}
          confirmLabel={t.admin.treasury.registerTopup}
          isPending={isPending}
          onBack={() => setReview(null)}
          onConfirm={confirm}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleReview} noValidate className={card}>
      <p className="mb-3 text-[13px] font-bold text-brand-near-black">{t.admin.treasury.newTopup}</p>
      <div className="space-y-3">
        <MemberCombobox
          members={members}
          value={member}
          onChange={setMember}
          label={t.admin.treasury.memberLabel}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.admin.treasury.amountLabel}>
            {(id) => (
              <input
                id={id}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.admin.treasury.amountPlaceholder}
                className={inputCls}
              />
            )}
          </Field>
          <Field label={t.admin.treasury.dateLabel}>
            {(id) => (
              <input
                id={id}
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={inputCls}
              />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.admin.treasury.methodLabel}>
            {(id) => <MethodSelect id={id} value={method} onChange={setMethod} />}
          </Field>
          <Field label={t.admin.treasury.externalRefLabel}>
            {(id) => (
              <input
                id={id}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder={t.admin.treasury.externalRefPlaceholder}
                className={inputCls}
              />
            )}
          </Field>
        </div>
        <Field label={t.admin.treasury.noteLabel}>
          {(id) => (
            <input
              id={id}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.admin.treasury.notePlaceholder}
              className={inputCls}
            />
          )}
        </Field>
      </div>
      {formError && (
        <p role="alert" className="mt-3 text-[12px] text-brand-red">
          {formError}
        </p>
      )}
      <button type="submit" className="mt-4 w-full rounded-xl bg-brand-teal py-2 text-[13px] font-bold text-white">
        {t.admin.treasury.review}
      </button>
    </form>
  );
}

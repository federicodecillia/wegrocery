"use client";

import type { ReactNode } from "react";
import { MovementIcon } from "@/components/movement-icon";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { t, type Strings } from "@/lib/i18n";
import { formatDateTime, formatSignedMoney } from "@/lib/i18n/format";
import { MANUAL_PAYMENT_METHODS } from "@/lib/ledger";
import { movementDateHasTime, movementKind, movementLabel, type MovementRecorder } from "@/lib/movement-label";

// A ledger row as the Storico detail shows it (built in app/storico/page.tsx).
export type MovementDetail = {
  type: string;
  amount: string;
  note: string | null;
  entryDate: Date;
  paymentId: string | null;
  cycleId: string | null;
  cycleTitle: string | null;
  method: string | null;
  externalRef: string | null;
  paymentStatus: string | null;
  recordedBy: MovementRecorder;
};

type PaymentStatus = keyof Strings["history"]["paymentStatuses"];

function paymentStatusLabel(status: string | null): string {
  const labels = t.history.paymentStatuses;
  return status !== null && Object.prototype.hasOwnProperty.call(labels, status)
    ? labels[status as PaymentStatus]
    : "—";
}

function recorderLabel(recorder: MovementRecorder): string {
  switch (recorder.kind) {
    case "online":
      return t.history.recordedOnline;
    case "admin":
      return recorder.name;
    case "system":
      return t.history.recordedSystem;
  }
}

// Only the rows the movement has: a manual top-up shows method and reference,
// an online one the payment status, a cycle charge its cycle.
function detailRows(entry: MovementDetail, onShowCycle: (cycleId: string) => void) {
  const h = t.history;
  const rows: Array<{ label: string; value: ReactNode }> = [
    {
      label: h.detailDate,
      value: formatDateTime(entry.entryDate, {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...(movementDateHasTime(entry.entryDate) ? { hour: "2-digit", minute: "2-digit" } : {}),
      }),
    },
  ];
  const { cycleId, cycleTitle } = entry;
  if (cycleId && cycleTitle) {
    rows.push({
      label: h.detailCycle,
      value: (
        <button
          type="button"
          onClick={() => onShowCycle(cycleId)}
          className="text-right font-semibold text-accent-text underline"
        >
          {cycleTitle}
        </button>
      ),
    });
  }
  // Online rows carry a fixed note that repeats the label.
  const note = entry.note?.trim();
  if (note && !entry.paymentId) rows.push({ label: h.detailNote, value: note });
  const method = MANUAL_PAYMENT_METHODS.find((m) => m === entry.method);
  if (method) rows.push({ label: h.detailMethod, value: t.admin.treasury.methods[method] });
  if (entry.externalRef) {
    rows.push({ label: h.detailReference, value: <span className="font-mono">{entry.externalRef}</span> });
  }
  if (entry.paymentId) rows.push({ label: h.detailPaymentStatus, value: paymentStatusLabel(entry.paymentStatus) });
  rows.push({ label: h.detailRecordedBy, value: recorderLabel(entry.recordedBy) });
  return rows;
}

export function MovementDetailDialog({
  entry,
  onClose,
  onShowCycle,
}: {
  entry: MovementDetail | null;
  onClose: () => void;
  onShowCycle: (cycleId: string) => void;
}) {
  const incoming = entry ? parseFloat(entry.amount) >= 0 : true;
  return (
    <Sheet
      open={entry !== null}
      onRequestClose={onClose}
      size="sm"
      title={
        entry && (
          <span className="flex items-center gap-3">
            <MovementIcon kind={movementKind(entry)} incoming={incoming} />
            {movementLabel(entry, t.history)}
          </span>
        )
      }
      footer={
        <Button block onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      {entry && (
        <>
          <p
            className={`font-mono text-[26px] font-black tracking-[-0.03em] ${
              incoming ? "text-accent-text" : "text-brand-red"
            }`}
          >
            {formatSignedMoney(entry.amount)}
          </p>
          <dl className="mt-4 divide-y divide-brand-border rounded-xl border border-brand-border bg-white">
            {detailRows(entry, onShowCycle).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <dt className="shrink-0 text-label font-semibold uppercase tracking-wide text-brand-gray">
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words text-right text-[14px] text-brand-near-black">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Sheet>
  );
}

"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MovementIcon } from "@/components/movement-icon";
import { Button } from "@/components/ui/button";
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
    <Dialog.Root open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[90%] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-brand-border bg-white p-6 shadow-[0_8px_32px_rgba(45,43,41,0.15)] data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95">
          {entry && (
            <>
              <div className="flex items-center gap-3">
                <MovementIcon kind={movementKind(entry)} incoming={incoming} />
                <Dialog.Title className="text-[17px] font-black tracking-[-0.02em] text-brand-near-black">
                  {movementLabel(entry, t.history)}
                </Dialog.Title>
              </div>
              <p
                className={`mt-3 font-mono text-[26px] font-black tracking-[-0.03em] ${
                  incoming ? "text-accent-text" : "text-brand-red"
                }`}
              >
                {formatSignedMoney(entry.amount)}
              </p>
              <Dialog.Description className="sr-only">{t.history.detailDescription}</Dialog.Description>
              <dl className="mt-4 divide-y divide-brand-border rounded-xl border border-brand-border">
                {detailRows(entry, onShowCycle).map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="shrink-0 text-label font-semibold uppercase tracking-wide text-brand-gray">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 break-words text-right text-[14px] text-brand-near-black">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <Button block className="mt-5" onClick={onClose}>
                {t.common.close}
              </Button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

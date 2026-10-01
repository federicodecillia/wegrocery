"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { adminPreviewSettlement, adminSettleCycle, type SettlementPreviewRow } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/i18n/format";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

// "Chiudi i conti" of a pay-per-order cycle, closed or cancelled: a preview of
// what each member gets (card refund, amount due, write-off) and the
// settlement itself, which can run again at any time.
export function SettleCycleButton({
  cycleId,
  cycleTitle,
  settledAt,
}: {
  cycleId: string;
  cycleTitle: string;
  settledAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SettlementPreviewRow[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const s = t.admin.settlement;

  function load() {
    setOpen(true);
    setRows(null);
    startTransition(async () => {
      const result = await adminPreviewSettlement(cycleId);
      if ("error" in result) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      setRows(result.rows);
    });
  }

  function settle() {
    startTransition(async () => {
      const result = await adminSettleCycle(cycleId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(s.done(result.refundsSent, result.refundsWaiting, result.due, result.writeOffs));
      setOpen(false);
    });
  }

  const pending = rows?.filter((r) => r.action !== "settled" && r.action !== "offline") ?? [];
  const excess = rows?.reduce((sum, r) => sum + r.excessCents, 0) ?? 0;

  return (
    <>
      <button
        onClick={load}
        className={`rounded-lg px-3 py-1 text-label font-bold ${
          settledAt ? "bg-accent-soft text-accent-text" : "bg-primary-soft text-primary-text"
        }`}
      >
        {settledAt ? s.settledButton(formatDate(settledAt)) : s.openButton}
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[151] flex max-h-[90vh] w-[94%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-[0_8px_32px_rgba(45,43,41,0.15)]"
          >
            <div className="border-b border-brand-border px-5 py-4">
              <Dialog.Title className="text-[15px] font-bold text-brand-near-black">{s.title(cycleTitle)}</Dialog.Title>
              <p className="mt-1 text-[12px] text-brand-gray">{s.intro}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {rows === null ? (
                <p className="py-6 text-center text-[13px] text-brand-gray">{s.loading}</p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-brand-gray">{s.empty}</p>
              ) : (
                <ul className="divide-y divide-brand-border">
                  {rows.map((r) => (
                    <li key={r.memberId} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-brand-near-black">{r.fullName}</div>
                        <div className="font-mono text-label text-muted">{s.net(formatMoney(r.netCents / 100))}</div>
                      </div>
                      <div className="shrink-0 text-right text-[12px] text-brand-near-black">
                        {s.action[r.action](formatMoney(r.amountCents / 100))}
                        {r.excessCents > 0 && (
                          <div className="text-brand-red">{s.excess(formatMoney(r.excessCents / 100))}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {excess > 0 && <p className="mt-2 text-[12px] text-brand-red">{s.excessHint}</p>}
            </div>
            <div className="flex gap-2 border-t border-brand-border px-5 py-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-brand-border py-2 text-[13px] font-semibold text-brand-gray"
              >
                {t.admin.common.cancel}
              </button>
              <button
                onClick={settle}
                disabled={isPending || rows === null || pending.length === 0}
                className="flex-1 rounded-full bg-primary py-2 text-[13px] font-bold text-on-primary disabled:opacity-40"
              >
                {isPending ? s.running : s.confirm}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

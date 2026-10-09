"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetActions } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { adminPreviewSettlement, adminSettleCycle, type SettlementPreviewRow } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/i18n/format";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import type { SettlementStatus } from "@/lib/payments/settlement-store";

const STATUS_CLASSES: Record<SettlementStatus, string> = {
  to_settle: "bg-primary-soft text-primary-text",
  refunds_pending: "bg-black/[0.06] text-brand-gray",
  settled: "bg-accent-soft text-accent-text",
  needs_update: "bg-brand-red-light text-brand-red",
  refund_failed: "bg-brand-red-light text-brand-red",
};

// "Chiudi i conti" of a pay-per-order cycle, closed or cancelled: a preview of
// what each member gets (card refund, amount due, write-off) and the
// settlement itself, which can run again at any time.
export function SettleCycleButton({
  cycleId,
  cycleTitle,
  settledAt,
  status,
}: {
  cycleId: string;
  cycleTitle: string;
  settledAt: string | null;
  status: SettlementStatus;
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
      <button onClick={load} className={`min-h-9 rounded-lg px-3 py-1 text-label font-bold ${STATUS_CLASSES[status]}`}>
        {status === "settled" && settledAt ? s.settledButton(formatDate(settledAt)) : s.status[status]}
      </button>
      <Sheet
        open={open}
        onRequestClose={() => !isPending && setOpen(false)}
        title={s.title(cycleTitle)}
        subtitle={s.intro}
        footer={
          <SheetActions>
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.admin.common.cancel}
            </Button>
            <Button
              variant="brand"
              className="flex-1"
              onClick={settle}
              // A cycle never settled can be closed even with everyone square,
              // and a run also resends the refunds still waiting.
              disabled={isPending || rows === null || (pending.length === 0 && status === "settled")}
            >
              {isPending && rows !== null ? s.running : s.confirm}
            </Button>
          </SheetActions>
        }
      >
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
                <div className="shrink-0 text-right text-[13px] text-brand-near-black">
                  {s.action[r.action](formatMoney(r.amountCents / 100))}
                  {r.excessCents > 0 && (
                    <div className="text-brand-red">{s.excess(formatMoney(r.excessCents / 100))}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {excess > 0 && <p className="mt-2 text-[13px] text-brand-red">{s.excessHint}</p>}
      </Sheet>
    </>
  );
}

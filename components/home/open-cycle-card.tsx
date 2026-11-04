import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import type { HomeOrderStatus } from "@/lib/payments/order-payment";
import { formatEur } from "@/lib/utils";
import { CycleCountdown } from "./cycle-countdown";

export type OpenCycleCardLine = {
  id: string;
  name: string;
  detail: string | null;
  emoji: string | null;
  quantity: number;
  total: number;
};

// Home → Ordini aperti: one open cycle, compact. Its head (deadline, pickups,
// the last-day countdown), the admin's notes, where a card payment stands,
// then the member's order folded into one line ("Il tuo ordine · 5 prodotti
// · 23,40 €") that opens on a tap, or the way to order.
export function OpenCycleCard({
  cycle,
  payStatus,
  lines,
  orderTotal,
}: {
  cycle: {
    cycleId: string;
    title: string;
    notes: string | null;
    orderOpenAt: string;
    orderCloseAt: string;
    pickupDate: string | null;
    pickupEndTime: string | null;
    pickup2Date: string | null;
    pickup2EndTime: string | null;
  };
  payStatus: HomeOrderStatus;
  lines: OpenCycleCardLine[];
  orderTotal: number;
}) {
  const orderHref = `/ordine?cycleId=${cycle.cycleId}`;
  const notes = cycle.notes?.trim();
  return (
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="px-4 pb-3 pt-3.5">
        <CycleCountdown
          title={cycle.title}
          orderCloseAt={cycle.orderCloseAt}
          orderOpenAt={cycle.orderOpenAt}
          pickupDate={cycle.pickupDate}
          pickupEndTime={cycle.pickupEndTime}
          pickup2Date={cycle.pickup2Date}
          pickup2EndTime={cycle.pickup2EndTime}
        />
        {notes && (
          <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-tint/[0.04] px-3 py-2 text-[13px] leading-[1.45] text-foreground">
            {notes}
          </p>
        )}
      </div>

      {payStatus && (
        <Link
          href={orderHref}
          className={`flex min-h-11 items-center justify-between border-t px-4 text-[14px] font-semibold ${
            payStatus.kind === "paid" ? "border-accent/25 bg-accent-bg text-accent-text" : "border-primary-mid bg-primary-bg text-primary-text"
          }`}
        >
          <span>
            {payStatus.kind === "draft"
              ? t.order.pay.statusDraft(formatEur(payStatus.amountCents / 100))
              : payStatus.kind === "paid"
                ? t.order.pay.statusPaid(formatEur(payStatus.amountCents / 100))
                : payStatus.kind === "changes"
                  ? t.order.pay.statusChanges(formatEur(payStatus.amountCents / 100))
                  : t.order.pay.statusChangesNoPay}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {lines.length > 0 ? (
        <details className="group border-t border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[14px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="tabular-nums">{t.home.orderSummary(lines.length, formatEur(orderTotal))}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0 text-secondary-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="border-t border-border">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="flex min-w-0 items-start gap-2">
                  <span aria-hidden="true" className="mt-0.25 w-[18px] shrink-0 text-[18px] leading-none">
                    {line.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-foreground">{line.name}</div>
                    {line.detail && <div className="tabular-nums text-label text-secondary-foreground">{line.detail}</div>}
                  </div>
                </div>
                <div className="shrink-0 tabular-nums text-[13px] font-semibold text-foreground">
                  ×{line.quantity} · {formatEur(line.total)}
                </div>
              </li>
            ))}
          </ul>
          <Link href={orderHref} className="flex min-h-11 items-center justify-between bg-tint/[0.03] px-4 text-[14px] font-semibold text-primary-text">
            {t.home.editOrder}
            <span aria-hidden="true">→</span>
          </Link>
        </details>
      ) : (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-[13px] text-secondary-foreground">{t.cycle.notOrderedYet}</p>
          <Link
            href={orderHref}
            // buttonVariants lives in a client module: its brand classes, spelled out for this server component.
            className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5.5 py-3.5 text-sm font-bold tracking-tight text-primary-foreground"
          >
            {t.cycle.goToOrder}
          </Link>
        </div>
      )}
    </article>
  );
}

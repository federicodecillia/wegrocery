import Link from "next/link";
import { AlarmClock, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import { deadlineParts, formatPickupLong } from "@/lib/i18n/deadline";
import type { HomeOrderStatus } from "@/lib/payments/order-payment";
import { daysFrom, deadlineDay, relativeDay } from "@/lib/home";
import { cn, formatEur } from "@/lib/utils";
import { DateTile } from "./date-tile";

export type OpenCycleCardLine = {
  id: string;
  name: string;
  detail: string | null;
  emoji: string | null;
  quantity: number;
  total: number;
};

export type OpenCycleCardCycle = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  notes: string | null;
  /** ISO. */
  orderCloseAt: string;
  pickups: { date: string; endTime: string | null }[];
  /** "Ritiro da confermare". */
  pickupTentative?: boolean;
};

// Small actions: 44 px tall, as wide as their word. The filled one only when
// the member has something to do (order, pay, confirm).
const PILL = "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[15px]";
const PILL_FILLED = `${PILL} bg-primary font-bold text-primary-foreground`;
const PILL_OUTLINE = `${PILL} border border-border bg-card font-semibold text-foreground`;

// Home → Da ordinare: one open cycle. Its deadline as a date tile and in
// words (the weekday in full, "domani" or "Ultimo giorno"), the pickup, the
// admin's notes, then one footer: what the member has done on the left, one
// action on the right. The order lines fold away; "Modifica" never does.
export function OpenCycleCard({
  cycle,
  today,
  payStatus,
  lines,
  orderTotal,
}: {
  cycle: OpenCycleCardCycle;
  /** "YYYY-MM-DD" in the group's time zone, from the server. */
  today: string;
  payStatus: HomeOrderStatus;
  lines: OpenCycleCardLine[];
  orderTotal: number;
}) {
  const h = t.home;
  const orderHref = `/ordine?cycleId=${encodeURIComponent(cycle.cycleId)}`;
  const closeAt = new Date(cycle.orderCloseAt);
  const day = deadlineDay(closeAt);
  const days = daysFrom(today, day);
  const lastDay = days <= 0;
  const deadline = deadlineParts(closeAt);
  const notes = cycle.notes?.trim();
  const toPay = payStatus && payStatus.kind !== "paid" ? payStatus : null;
  const paid = payStatus?.kind === "paid";

  return (
    <article className={cn("overflow-hidden rounded-card border bg-card shadow-card", lastDay ? "border-destructive/30" : "border-border")}>
      <div className="flex gap-3 px-4 pb-3 pt-3.5">
        <DateTile day={day} tone={lastDay ? "urgent" : "open"} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold leading-snug tracking-[-0.01em] text-foreground">{cycle.title}</h3>
          {cycle.supplierName && <p className="text-[14px] text-secondary-foreground">{cycle.supplierName}</p>}
          <p className={cn("mt-1 text-[15px]", lastDay ? "font-bold text-destructive" : "text-foreground")}>
            {h.orderBy(deadline.day, deadline.time)}
          </p>
          <p className={cn("flex items-center gap-1 text-[14px]", lastDay ? "font-semibold text-destructive" : "text-secondary-foreground")}>
            {lastDay && <AlarmClock aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />}
            {lastDay ? h.lastDay : relativeDay(days)}
          </p>
          {cycle.pickups.map((p, i) => (
            <p key={i} className="text-[14px] text-secondary-foreground">
              {(cycle.pickupTentative ? h.pickupExpected : h.pickupOn)(formatPickupLong(p.date, p.endTime))}
            </p>
          ))}
          {notes && <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-[14px] text-foreground">{notes}</p>}
        </div>
      </div>

      {toPay && (
        <div className="flex items-center justify-between gap-3 border-t border-primary-mid bg-primary-bg px-4 py-1.5">
          <span className="min-w-0 text-[14px] font-semibold text-primary-text">
            {toPay.kind === "draft"
              ? t.order.pay.statusDraft(formatEur(toPay.amountCents / 100))
              : toPay.kind === "changes"
                ? t.order.pay.statusChanges(formatEur(toPay.amountCents / 100))
                : t.order.pay.statusChangesNoPay}
          </span>
          <Link href={orderHref} className={PILL_FILLED}>
            {toPay.kind === "changes_no_pay" ? h.editCta : h.payCta}
          </Link>
        </div>
      )}

      {lines.length > 0 ? (
        <div className="relative border-t border-border">
          <details className="group">
            <summary
              className={cn(
                "flex min-h-14 cursor-pointer list-none items-center gap-2 py-1.5 pl-4 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden",
                toPay ? "pr-4" : "pr-32",
              )}
            >
              <ChevronDown aria-hidden className="size-5 shrink-0 text-primary-text transition-transform group-open:rotate-180" />
              <span className="min-w-0 tabular-nums">{h.ordered(lines.length, formatEur(orderTotal))}</span>
              {paid && <Badge variant="accent">{h.paidBadge}</Badge>}
            </summary>
            <ul className="divide-y divide-border border-t border-border bg-tint/[0.03]">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <span aria-hidden="true" className="w-[18px] shrink-0 text-[17px] leading-tight">
                      {line.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] text-foreground">{line.name}</div>
                      {line.detail && <div className="tabular-nums text-[13px] text-secondary-foreground">{line.detail}</div>}
                    </div>
                  </div>
                  <div className="shrink-0 tabular-nums text-[14px] font-semibold text-foreground">
                    ×{line.quantity} · {formatEur(line.total)}
                  </div>
                </li>
              ))}
            </ul>
          </details>
          {/* Beside the summary, not inside it: a link in a <summary> would toggle it too. */}
          {!toPay && (
            <Link href={orderHref} className={cn(PILL_OUTLINE, "absolute right-4 top-1.5")}>
              {h.editCta}
            </Link>
          )}
        </div>
      ) : (
        !toPay && (
          <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-1.5">
            <span className="text-[15px] text-secondary-foreground">{h.notOrdered}</span>
            <Link href={orderHref} className={PILL_FILLED}>
              {h.orderCta}
            </Link>
          </div>
        )
      )}
    </article>
  );
}

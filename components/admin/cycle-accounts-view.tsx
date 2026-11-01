import Link from "next/link";
import { getCycleLedgerRows } from "@/lib/db/queries";
import { summarizeCycleMoney } from "@/lib/admin/cycle-money";
import { adminHref } from "@/lib/admin/nav";
import { movementKindLabel, movementText } from "@/lib/movement-label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import type { SettlementStatus } from "@/lib/payments/settlement-store";
import type { SerializedCycle } from "./ciclo-forms";
import { CancelCycleButton } from "./cancel-cycle-dialog";
import { SettleCycleButton } from "./settle-cycle-dialog";

const ADJUSTMENTS_SHOWN = 20;

// Admin → Ciclo → Conti: the money of a closed (or cancelled) cycle in one
// place. What it moved on the balances and the corrections made, read only
// from its live ledger rows; how to correct it; "Chiudi i conti" for a card
// cycle; at the bottom, cancelling it.
export async function CycleAccountsView({
  cycle,
  settledAt,
  settlement,
  notCollected = 0,
}: {
  cycle: SerializedCycle;
  settledAt: string | null;
  settlement: SettlementStatus | null;
  /** Members still to collect, once some pickups were marked: a warning before "Chiudi i conti". */
  notCollected?: number;
}) {
  const money = summarizeCycleMoney(await getCycleLedgerRows(cycle.cycleId));
  const a = t.admin.workspace.accounts;
  const w = t.admin.workspace;
  const h = t.history;
  const signed = (cents: number) => formatMoney(cents / 100);
  const shown = money.adjustments.slice(0, ADJUSTMENTS_SHOWN);

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-4">
        {settlement && (
          <Card className="border-primary-mid">
            <CardContent>
              <h3 className="text-[14px] font-bold text-foreground">{a.settleTitle}</h3>
              <p className="mt-1 mb-3 max-w-prose text-[13px] text-secondary-foreground">{w.accountsIntro}</p>
              <SettleCycleButton
                cycleId={cycle.cycleId}
                cycleTitle={cycle.title}
                settledAt={settledAt}
                status={settlement}
                notCollected={notCollected}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h3 className="text-[13px] font-bold text-foreground">{a.movementsTitle}</h3>
            <p className="mt-0.5 text-label text-secondary-foreground">{a.movementsHint}</p>
          </CardHeader>
          {money.lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-secondary-foreground">{a.noMovements}</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {money.lines.map((l) => (
                  <li key={l.kind} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 text-[13px] text-foreground">
                      {movementKindLabel(l.kind, h)}
                      <span className="ml-1.5 text-label text-muted-foreground">{a.movementsCount(l.count)}</span>
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-foreground">{signed(l.cents)}</span>
                  </li>
                ))}
              </ul>
              <CardContent className="border-t border-border py-2.5">
                <div className="flex justify-between text-[13px] font-bold text-foreground">
                  <span>{a.net}</span>
                  <span className=" tabular-nums">{signed(money.netCents)}</span>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <Card>
          <CardContent>
            <h3 className="text-[13px] font-bold text-foreground">{a.shippingTitle}</h3>
            <p className="mt-1 text-[13px] text-foreground">{shippingText(cycle) ?? a.shippingNone}</p>
            {cycle.status === "closed" && (
              <p className="mt-1 text-label text-secondary-foreground">
                {cycle.shippingMode === "manual" ? t.admin.cycle.shippingManualDescription : a.shippingEditHint}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-[13px] font-bold text-foreground">
              {a.adjustmentsTitle} <span className="font-normal text-secondary-foreground">({money.adjustments.length})</span>
            </h3>
          </CardHeader>
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-secondary-foreground">{a.noAdjustments}</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((r) => (
                <li key={r.entryId} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-foreground">{r.memberName}</span>
                    <span className="block text-label text-secondary-foreground">
                      {movementText(r, h)} · {formatDate(r.entryDate, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-foreground">{formatMoney(r.amount)}</span>
                </li>
              ))}
              {money.adjustments.length > shown.length && (
                <li className="px-4 py-2 text-label text-muted-foreground">{a.moreAdjustments(money.adjustments.length - shown.length)}</li>
              )}
            </ul>
          )}
        </Card>

        {cycle.status === "closed" && (
          <Card>
            <CardContent>
              <h3 className="text-[13px] font-bold text-foreground">{a.howTitle}</h3>
              <ul className="mt-2 space-y-2 text-[13px] text-secondary-foreground">
                <li>{a.howPrices}</li>
                <li>
                  {a.howWeights}{" "}
                  <Link href={adminHref("ciclo", "ordini", { cycle: cycle.cycleId })} className="font-semibold text-primary-text">
                    {a.goOrders}
                  </Link>
                </li>
                <li>
                  {a.howDistinta}{" "}
                  <Link href={adminHref("ciclo", "fornitore", { cycle: cycle.cycleId })} className="font-semibold text-primary-text">
                    {a.goSupplier}
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        {cycle.status === "closed" && (
          <Card className="border-destructive/30">
            <CardContent>
              <h3 className="text-[14px] font-bold text-destructive">{w.dangerZone}</h3>
              <p className="mt-1 mb-3 max-w-prose text-[13px] text-secondary-foreground">{w.cancelIntro}</p>
              <CancelCycleButton cycleId={cycle.cycleId} cycleTitle={cycle.title} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function shippingText(c: SerializedCycle): string | null {
  if (c.shippingMode === "manual") return t.admin.cycle.shippingManualTitle;
  if (c.shippingMode === "proportional") {
    return c.shippingTotal && parseFloat(c.shippingTotal) > 0
      ? t.admin.cycle.shippingProportionalDisplay(formatMoney(c.shippingTotal))
      : null;
  }
  return c.shippingCostPerMember && parseFloat(c.shippingCostPerMember) > 0
    ? t.admin.cycle.shippingPerMemberDisplay(formatMoney(c.shippingCostPerMember))
    : null;
}

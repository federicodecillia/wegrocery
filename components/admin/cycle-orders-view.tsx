import { getAdminCycleSummary } from "@/lib/db/queries";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { CsvExportButton } from "./ordini-client";
import { CycleOrdersByMember } from "./closed-cycle-details";
import { OrdersSplit } from "./orders-split";

// Admin → Ciclo → Ordini: the cycle's orders in one place, "Per socio" and
// "Per prodotto" (side by side from a PC), with the one "Scarica distinta".
// Before, the same list lived in the Ordini tab, in the Recap sheet and in the
// Excel file; a closed cycle's weights and orders are corrected here.
export async function CycleOrdersView({
  cycleId,
  cycleTitle,
  editable,
}: {
  cycleId: string;
  cycleTitle: string;
  editable: boolean;
}) {
  const summary = await getAdminCycleSummary(cycleId);
  const o = t.admin.orders;

  const byMember = (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-foreground">{o.perMemberTitle}</h3>
      </CardHeader>
      <CycleOrdersByMember cycleId={cycleId} cycleTitle={cycleTitle} editable={editable} />
    </Card>
  );

  const byProduct = (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-foreground">{o.perProductTitle}</h3>
        <p className="mt-0.5 text-label text-secondary-foreground">{o.perProductSubtitle}</p>
      </CardHeader>
      {summary.byProduct.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-secondary-foreground">{o.noOrdersInCycle}</p>
      ) : (
        <ul className="divide-y divide-border">
          {summary.byProduct.map((p) => (
            <li key={p.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="text-[16px] leading-none">
                  {getProductEmoji(p.name)}
                </span>
                <span className="min-w-0 text-[13px] font-medium text-foreground">
                  {p.name}
                  {p.variant && <span className="font-normal text-secondary-foreground"> · {p.variant}</span>}
                  {p.unit && <span className="ml-1 tabular-nums text-label text-muted-foreground">/{p.unit}</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums text-[12px] text-secondary-foreground">×{p.totalQty}</span>
                <span className=" text-[13px] font-bold tabular-nums text-foreground">
                  {formatEur(p.totalAmount)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <CardContent className="border-t border-border py-2.5">
        <div className="flex justify-between text-[13px] font-bold text-foreground">
          <span>{o.totalProducts}</span>
          <span className=" tabular-nums">{formatEur(summary.productsTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary-bg px-4 py-3">
          <div className="text-label text-secondary-foreground">{o.membersLabel}</div>
          <div className="text-[22px] font-bold text-foreground">{summary.orderCount}</div>
        </div>
        <div className="rounded-xl bg-accent-bg px-4 py-3">
          <div className="text-label text-secondary-foreground">{o.totalLabel}</div>
          <div className="text-[22px] font-bold tabular-nums text-foreground">{formatEur(summary.grandTotal)}</div>
          {summary.shippingTotal > 0 && (
            <div className="mt-0.5 text-label text-muted-foreground">
              {o.productsBreakdown(formatEur(summary.productsTotal), formatEur(summary.shippingTotal))}
            </div>
          )}
        </div>
      </div>
      {summary.orderCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-prose text-[13px] text-secondary-foreground">{o.distintaHint}</p>
          <CsvExportButton cycleId={cycleId} />
        </div>
      )}
      <OrdersSplit byMember={byMember} byProduct={byProduct} />
    </div>
  );
}

import {
  getAllCycles,
  getAllMembers,
  getAdminCycleSummary,
  getAdminMemberOrders,
  getOpenCycles,
} from "@/lib/db/queries";
import { formatDate, formatEur, getProductEmoji } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { CsvExportButton, OrdiniByMember, OrdiniFilters } from "./ordini-client";

type Props = { cycleId?: string; memberId?: string };

export async function TabOrdini({ cycleId, memberId }: Props) {
  const [openCycles, allCycles, allMembers] = await Promise.all([
    getOpenCycles(),
    getAllCycles(20),
    getAllMembers(),
  ]);

  const filterCycles = allCycles.map((c) => ({ cycleId: c.cycleId, title: c.title }));
  const filterMembers = allMembers.map((m) => ({ memberId: m.memberId, fullName: m.fullName }));

  // ── Member view ─────────────────────────────────────────────────────────────
  if (memberId) {
    const selectedMember = allMembers.find((m) => m.memberId === memberId);
    const orders = await getAdminMemberOrders(memberId);

    return (
      <div className="space-y-4">
        <OrdiniFilters allCycles={filterCycles} allMembers={filterMembers} />

        {selectedMember && (
          <div className="rounded-xl border border-brand-border bg-white px-4 py-3 shadow-sm">
            <div className="text-[13px] font-bold text-brand-near-black">{selectedMember.fullName}</div>
            <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
              {selectedMember.email} · {orders.length} cicl{orders.length === 1 ? "o" : "i"} ·{" "}
              {formatEur(orders.reduce((s, o) => s + o.total, 0))} totale
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border p-6 text-center text-[13px] text-brand-gray">
            {t.admin.orders.noMemberOrders}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((cycle) => (
              <Card key={cycle.cycleId}>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-brand-near-black">{cycle.cycleTitle}</div>
                    {cycle.pickupDate && (
                      <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
                        {t.admin.orders.pickupLabel} {formatDate(cycle.pickupDate)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        cycle.cycleStatus === "open"
                          ? "bg-brand-teal-light text-brand-teal"
                          : "bg-black/[0.05] text-brand-gray"
                      }`}
                    >
                      {cycle.cycleStatus === "open" ? t.admin.orders.openBadge : t.admin.orders.closedBadge}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-brand-near-black">
                      {formatEur(cycle.total)}
                    </span>
                  </div>
                </CardHeader>
                <div className="divide-y divide-brand-border">
                  {cycle.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] text-brand-near-black">
                        <span className="text-[16px] leading-none">{getProductEmoji(line.productName)}</span>
                        {line.productName}
                        {line.variant && (
                          <span className="text-brand-gray">· {line.variant}</span>
                        )}
                        <span className="font-mono text-[11px] text-brand-gray-light">
                          ×{line.quantity}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] text-brand-near-black">
                        {formatEur(line.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Cycle view (default) ────────────────────────────────────────────────────
  const selectedId = cycleId ?? openCycles[0]?.cycleId ?? allCycles[0]?.cycleId;

  if (!selectedId) {
    return (
      <div className="space-y-4">
        <OrdiniFilters allCycles={filterCycles} allMembers={filterMembers} />
        <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-[13px] text-brand-gray">
          {t.admin.orders.noCycleAvailable}
        </div>
      </div>
    );
  }

  const [summary, selectedCycle] = await Promise.all([
    getAdminCycleSummary(selectedId),
    Promise.resolve(allCycles.find((c) => c.cycleId === selectedId)),
  ]);

  return (
    <div className="space-y-4">
      <OrdiniFilters allCycles={filterCycles} allMembers={filterMembers} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-brand-orange-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-brand-gray">{t.admin.orders.membersLabel}</div>
          <div className="text-[24px] font-bold text-brand-near-black">{summary.orderCount}</div>
        </div>
        <div className="rounded-xl bg-brand-teal-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-brand-gray">{t.admin.orders.totalLabel}</div>
          <div className="text-[24px] font-bold text-brand-near-black">
            {formatEur(summary.grandTotal)}
          </div>
          {summary.shippingTotal > 0 && (
            <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
              {t.admin.orders.productsBreakdown(formatEur(summary.productsTotal), formatEur(summary.shippingTotal))}
            </div>
          )}
        </div>
      </div>

      {summary.orderCount === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border p-6 text-center text-[13px] text-brand-gray">
          {t.admin.orders.noOrdersInCycle}
        </div>
      ) : (
        <>
          {/* By member */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-brand-near-black">{t.admin.orders.perMemberTitle}</h3>
              <CsvExportButton cycleId={selectedId} cycleTitle={selectedCycle?.title ?? selectedId} />
            </CardHeader>
            <OrdiniByMember byMember={summary.byMember} />
            <CardBody className="border-t border-brand-border py-2.5">
              <div className="flex justify-between text-[13px] font-bold text-brand-near-black">
                <span>{t.admin.orders.totalRow}</span>
                <span className="font-mono">{formatEur(summary.grandTotal)}</span>
              </div>
            </CardBody>
          </Card>

          {/* By product */}
          <Card>
            <CardHeader>
              <h3 className="text-[13px] font-bold text-brand-near-black">{t.admin.orders.perProductTitle}</h3>
              <p className="mt-0.5 text-[11px] text-brand-gray">
                {t.admin.orders.perProductSubtitle}
              </p>
            </CardHeader>
            <div className="divide-y divide-brand-border">
              {summary.byProduct.map((p) => (
                <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] leading-none">{getProductEmoji(p.name)}</span>
                    <span className="text-[13px] font-medium text-brand-near-black">
                      {p.name}
                      {p.unit && <span className="ml-1 font-mono text-[10px] text-brand-gray-light">/{p.unit}</span>}
                    </span>
                    {p.variant && (
                      <span className="text-[12px] text-brand-gray">{p.variant}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-brand-gray">×{p.totalQty}</span>
                    <span className="font-mono text-[13px] font-bold text-brand-near-black">
                      {formatEur(p.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <CardBody className="border-t border-brand-border py-2.5">
              <div className="flex justify-between text-[13px] font-bold text-brand-near-black">
                <span>{t.admin.orders.totalProducts}</span>
                <span className="font-mono">{formatEur(summary.productsTotal)}</span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

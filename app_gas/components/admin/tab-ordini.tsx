import {
  getAllCycles,
  getAllMembers,
  getAdminCycleSummary,
  getAdminMemberOrders,
  getOpenCycles,
} from "@/lib/db/queries";
import { formatDate, formatEur, getProductEmoji } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
          <div className="rounded-xl border border-pm-border bg-white px-4 py-3 shadow-sm">
            <div className="text-[13px] font-bold text-pm-near-black">{selectedMember.fullName}</div>
            <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
              {selectedMember.email} · {orders.length} cicl{orders.length === 1 ? "o" : "i"} ·{" "}
              {formatEur(orders.reduce((s, o) => s + o.total, 0))} totale
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-pm-border p-6 text-center text-[13px] text-pm-gray">
            Nessun ordine registrato.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((cycle) => (
              <Card key={cycle.cycleId}>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-pm-near-black">{cycle.cycleTitle}</div>
                    {cycle.pickupDate && (
                      <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
                        Ritiro: {formatDate(cycle.pickupDate)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        cycle.cycleStatus === "open"
                          ? "bg-pm-teal-light text-pm-teal"
                          : "bg-black/[0.05] text-pm-gray"
                      }`}
                    >
                      {cycle.cycleStatus === "open" ? "Aperto" : "Chiuso"}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-pm-near-black">
                      {formatEur(cycle.total)}
                    </span>
                  </div>
                </CardHeader>
                <div className="divide-y divide-pm-border">
                  {cycle.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] text-pm-near-black">
                        <span className="text-[16px] leading-none">{getProductEmoji(line.productName)}</span>
                        {line.productName}
                        {line.variant && (
                          <span className="text-pm-gray">· {line.variant}</span>
                        )}
                        <span className="font-mono text-[11px] text-pm-gray-light">
                          ×{line.quantity}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] text-pm-near-black">
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
        <div className="rounded-xl border border-dashed border-pm-border p-8 text-center text-[13px] text-pm-gray">
          Nessun ciclo disponibile.
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
        <div className="rounded-xl bg-pm-orange-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-pm-gray">Soci</div>
          <div className="text-[24px] font-bold text-pm-near-black">{summary.orderCount}</div>
        </div>
        <div className="rounded-xl bg-pm-teal-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-pm-gray">Totale</div>
          <div className="text-[24px] font-bold text-pm-near-black">
            {formatEur(summary.grandTotal)}
          </div>
          {summary.shippingTotal > 0 && (
            <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
              prodotti {formatEur(summary.productsTotal)} + spedizione {formatEur(summary.shippingTotal)}
            </div>
          )}
        </div>
      </div>

      {summary.orderCount === 0 ? (
        <div className="rounded-xl border border-dashed border-pm-border p-6 text-center text-[13px] text-pm-gray">
          Nessun ordine per questo ciclo.
        </div>
      ) : (
        <>
          {/* By member */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-pm-near-black">Per socio</h3>
              <CsvExportButton summary={summary} cycleTitle={selectedCycle?.title ?? selectedId} />
            </CardHeader>
            <OrdiniByMember byMember={summary.byMember} />
            <CardBody className="border-t border-pm-border py-2.5">
              <div className="flex justify-between text-[13px] font-bold text-pm-near-black">
                <span>Totale</span>
                <span className="font-mono">{formatEur(summary.grandTotal)}</span>
              </div>
            </CardBody>
          </Card>

          {/* By product */}
          <Card>
            <CardHeader>
              <h3 className="text-[13px] font-bold text-pm-near-black">Per prodotto</h3>
              <p className="mt-0.5 text-[11px] text-pm-gray">
                Totali al netto delle rettifiche di peso. La spedizione è esclusa
                perché non è legata a un prodotto.
              </p>
            </CardHeader>
            <div className="divide-y divide-pm-border">
              {summary.byProduct.map((p) => (
                <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] leading-none">{getProductEmoji(p.name)}</span>
                    <span className="text-[13px] font-medium text-pm-near-black">
                      {p.name}
                      {p.unit && <span className="ml-1 font-mono text-[10px] text-pm-gray-light">/{p.unit}</span>}
                    </span>
                    {p.variant && (
                      <span className="text-[12px] text-pm-gray">{p.variant}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-pm-gray">×{p.totalQty}</span>
                    <span className="font-mono text-[13px] font-bold text-pm-near-black">
                      {formatEur(p.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <CardBody className="border-t border-pm-border py-2.5">
              <div className="flex justify-between text-[13px] font-bold text-pm-near-black">
                <span>Totale prodotti</span>
                <span className="font-mono">{formatEur(summary.productsTotal)}</span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

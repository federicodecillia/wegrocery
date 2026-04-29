import Link from "next/link";
import { getAllCycles, getAdminCycleSummary, getOpenCycle } from "@/lib/db/queries";
import { formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CsvExportButton, OrdiniByMember } from "./ordini-client";

type Props = { cycleId?: string };

export async function TabOrdini({ cycleId }: Props) {
  const [openCycle, allCycles] = await Promise.all([getOpenCycle(), getAllCycles(20)]);

  const selectedId = cycleId ?? openCycle?.cycleId ?? allCycles[0]?.cycleId;

  if (!selectedId) {
    return (
      <div className="rounded-xl border border-dashed border-pm-border p-8 text-center text-[13px] text-pm-gray">
        Nessun ciclo disponibile.
      </div>
    );
  }

  const [summary, selectedCycle] = await Promise.all([
    getAdminCycleSummary(selectedId),
    Promise.resolve(allCycles.find((c) => c.cycleId === selectedId)),
  ]);

  return (
    <div className="space-y-4">
      {/* Cycle selector */}
      <div className="flex flex-wrap gap-1.5">
        {allCycles.slice(0, 8).map((c) => (
          <Link
            key={c.cycleId}
            href={`/admin?tab=ordini&cycle=${c.cycleId}`}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
              c.cycleId === selectedId
                ? "bg-pm-orange text-white"
                : "bg-black/[0.05] text-pm-gray"
            }`}
          >
            {c.title}
          </Link>
        ))}
      </div>

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
        </div>
      </div>

      {summary.orderCount === 0 ? (
        <div className="rounded-xl border border-dashed border-pm-border p-6 text-center text-[13px] text-pm-gray">
          Nessun ordine per questo ciclo.
        </div>
      ) : (
        <>
          {/* By product */}
          <Card>
            <CardHeader>
              <h3 className="text-[13px] font-bold text-pm-near-black">Per prodotto</h3>
            </CardHeader>
            <div className="divide-y divide-pm-border">
              {summary.byProduct.map((p) => (
                <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-[13px] font-medium text-pm-near-black">{p.name}</span>
                    {p.variant && (
                      <span className="ml-1.5 text-[12px] text-pm-gray">{p.variant}</span>
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
                <span>Totale</span>
                <span className="font-mono">{formatEur(summary.grandTotal)}</span>
              </div>
            </CardBody>
          </Card>

          {/* By member */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-pm-near-black">Per socio</h3>
              <CsvExportButton summary={summary} cycleTitle={selectedCycle?.title ?? selectedId} />
            </CardHeader>
            <OrdiniByMember byMember={summary.byMember} />
          </Card>
        </>
      )}
    </div>
  );
}

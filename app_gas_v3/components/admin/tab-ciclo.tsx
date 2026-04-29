import { getAllCycles, getAllSuppliers, getOpenCycle, getOpenCycleStats } from "@/lib/db/queries";
import { formatDate, formatDateTime, formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CloseCycleButton, CreateCycleForm } from "./ciclo-forms";

export async function TabCiclo() {
  const [openCycle, cycles, suppliers] = await Promise.all([
    getOpenCycle(),
    getAllCycles(15),
    getAllSuppliers(),
  ]);

  const stats = openCycle ? await getOpenCycleStats(openCycle.cycleId) : null;

  return (
    <div>
      {openCycle ? (
        <Card className="border-l-4 border-l-pm-teal">
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-pm-teal-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pm-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-pm-teal" />
                Aperto
              </span>
              <h3 className="mt-1 text-[15px] font-bold text-pm-near-black">{openCycle.title}</h3>
            </div>
            <CloseCycleButton cycleId={openCycle.cycleId} cycleTitle={openCycle.title} />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-pm-orange-light px-3 py-2">
                <div className="font-mono text-[11px] text-pm-gray">Ordini</div>
                <div className="text-[20px] font-bold text-pm-near-black">{stats?.orderCount ?? 0}</div>
              </div>
              <div className="rounded-lg bg-pm-teal-light px-3 py-2">
                <div className="font-mono text-[11px] text-pm-gray">Totale</div>
                <div className="text-[20px] font-bold text-pm-near-black">
                  {formatEur(stats?.grandTotal ?? 0)}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[12px] text-pm-gray">
              {openCycle.orderCloseAt && (
                <div>
                  Chiusura ordini:{" "}
                  <span className="font-semibold text-pm-near-black">
                    {formatDateTime(openCycle.orderCloseAt)}
                  </span>
                </div>
              )}
              {openCycle.pickupDate && (
                <div>
                  Ritiro:{" "}
                  <span className="font-semibold text-pm-near-black">
                    {formatDate(openCycle.pickupDate)}
                  </span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-pm-border p-4 text-center text-[13px] text-pm-gray">
          Nessun ciclo aperto
        </div>
      )}

      <CreateCycleForm suppliers={suppliers} />

      {cycles.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <h3 className="text-[13px] font-bold text-pm-near-black">Ultimi cicli</h3>
          </CardHeader>
          <div className="divide-y divide-pm-border">
            {cycles.map((c) => (
              <div key={c.cycleId} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-pm-near-black">{c.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
                    {c.supplierName ?? "—"}
                    {c.pickupDate ? ` · ${formatDate(c.pickupDate)}` : ""}
                  </div>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    c.status === "open"
                      ? "bg-pm-teal-light text-pm-teal"
                      : "bg-black/[0.05] text-pm-gray"
                  }`}
                >
                  {c.status === "open" ? "Aperto" : "Chiuso"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

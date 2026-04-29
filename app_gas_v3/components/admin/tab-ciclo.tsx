import { getAllCycles, getAllSuppliers, getOpenCycle, getOpenCycleStats } from "@/lib/db/queries";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { CreateCycleForm, OpenCycleCard } from "./ciclo-forms";

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
        <OpenCycleCard
          cycle={{
            cycleId: openCycle.cycleId,
            title: openCycle.title,
            orderCloseAt: openCycle.orderCloseAt?.toISOString() ?? null,
            pickupDate: openCycle.pickupDate?.toISOString() ?? null,
            notes: openCycle.notes ?? null,
          }}
          stats={{ orderCount: stats?.orderCount ?? 0, grandTotal: stats?.grandTotal ?? 0 }}
          suppliers={suppliers}
        />
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

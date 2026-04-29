import { getAdminCycleProducts, getAllCycles, getOpenCycle } from "@/lib/db/queries";
import { formatEur } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { DuplicateProductsForm, LoadProductsForm } from "./prodotti-forms";

export async function TabProdotti() {
  const openCycle = await getOpenCycle();

  if (!openCycle) {
    return (
      <div className="rounded-xl border border-dashed border-pm-border p-8 text-center text-[13px] text-pm-gray">
        Nessun ciclo aperto. Crea un ciclo dalla tab <span className="font-semibold">Ciclo</span>.
      </div>
    );
  }

  const [currentProducts, allCycles] = await Promise.all([
    getAdminCycleProducts(openCycle.cycleId),
    getAllCycles(20),
  ]);

  const pastCycles = allCycles
    .filter((c) => c.cycleId !== openCycle.cycleId && c.status === "closed")
    .map((c) => ({ cycleId: c.cycleId, title: c.title }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-pm-teal-light px-4 py-3">
        <p className="text-[12px] font-semibold text-pm-teal">
          Ciclo aperto: <span className="text-pm-near-black">{openCycle.title}</span>
          <span className="ml-2 text-pm-gray">({currentProducts.length} prodotti)</span>
        </p>
      </div>

      <LoadProductsForm cycleId={openCycle.cycleId} />
      <DuplicateProductsForm cycleId={openCycle.cycleId} pastCycles={pastCycles} />

      {currentProducts.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-[13px] font-bold text-pm-near-black">
              Prodotti correnti ({currentProducts.length})
            </h3>
          </CardHeader>
          <div className="divide-y divide-pm-border">
            {currentProducts.map((p, idx) => (
              <div key={p.productId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 shrink-0 font-mono text-[11px] text-pm-gray-light">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-pm-near-black">{p.name}</span>
                  {p.variant && (
                    <span className="ml-1.5 text-[12px] text-pm-gray">{p.variant}</span>
                  )}
                  {p.format && (
                    <span className="ml-1.5 font-mono text-[10px] text-pm-gray-light">
                      {p.format}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[13px] font-bold text-pm-near-black">
                  {formatEur(parseFloat(p.unitPrice))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

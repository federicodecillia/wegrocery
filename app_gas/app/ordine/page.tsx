import { AppShell } from "@/components/app-shell";
import { OrderForm } from "./order-form";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberOrderLines,
  getOpenCycles,
} from "@/lib/db/queries";
import { saveOrder } from "@/lib/actions/order";
import { canAccessCycle } from "@/lib/utils";
import Link from "next/link";

export default async function OrdinePage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string }>;
}) {
  const { cycleId: searchCycleId } = await searchParams;

  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, openCycles] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycles(),
  ]);

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));

  let openCycle = null;
  if (activeCycles.length > 0) {
    if (searchCycleId) {
      openCycle = activeCycles.find((c) => c.cycleId === searchCycleId) ?? activeCycles[0];
    } else {
      openCycle = activeCycles[0];
    }
  }

  if (!openCycle) {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">🛒</span>
          <h2 className="text-[18px] font-bold text-pm-near-black">Nessun ordine aperto</h2>
          <p className="mt-2 text-[14px] text-pm-gray">
            Torna quando l&apos;ordine sarà aperto.
          </p>
        </div>
      </AppShell>
    );
  }

  const [cycleProducts, existingLines] = await Promise.all([
    getCycleProducts(openCycle!.cycleId),
    getMemberOrderLines(memberId, openCycle!.cycleId),
  ]);

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      {activeCycles.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {activeCycles.map((c) => (
            <Link
              key={c.cycleId}
              href={`/ordine?cycleId=${c.cycleId}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors ${
                c.cycleId === openCycle!.cycleId
                  ? "bg-pm-teal text-white shadow-sm"
                  : "bg-white text-pm-gray border border-pm-border hover:bg-pm-warm-white"
              }`}
            >
              {c.title}
            </Link>
          ))}
        </div>
      )}
      <OrderForm
        cycleId={openCycle!.cycleId}
        cycleTitle={openCycle!.title}
        orderCloseAt={openCycle!.orderCloseAt?.toISOString() ?? null}
        products={cycleProducts.map((p) => ({
          productId: p.productId,
          name: p.name,
          variant: p.variant,
          format: p.format,
          unitPrice: p.unitPrice,
          pricePerKg: p.pricePerKg,
          unit: p.unit,
          category: p.category,
          sortOrder: p.sortOrder,
        }))}
        existingLines={existingLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        }))}
        balance={balance}
        saveAction={saveOrder}
      />
    </AppShell>
  );
}

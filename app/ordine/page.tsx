import { AppShell } from "@/components/app-shell";
import { OrderForm } from "./order-form";
import { CycleChooser } from "./cycle-chooser";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberOrderLines,
  getOpenCycles,
  getOrderDraft,
} from "@/lib/db/queries";
import { saveOrder } from "@/lib/actions/order";
import { canAccessCycle } from "@/lib/roles";
import { resolveOrderCycle } from "@/lib/order-cycle";
import { resumeDraft } from "@/lib/order-draft";
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

  const choice = resolveOrderCycle(activeCycles, searchCycleId);
  if (choice.kind === "choose") {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
        <CycleChooser cycles={activeCycles} />
      </AppShell>
    );
  }
  const openCycle = choice.kind === "open" ? choice.cycle : null;

  if (!openCycle) {
    return (
      <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">🛒</span>
          <h2 className="text-[18px] font-bold text-brand-near-black">{t.order.noOpenOrders}</h2>
          <p className="mt-2 text-[14px] text-brand-gray">
            {t.order.noOpenOrdersHint}
          </p>
        </div>
      </AppShell>
    );
  }

  const [cycleProducts, existingLines, storedDraft] = await Promise.all([
    getCycleProducts(openCycle!.cycleId),
    getMemberOrderLines(memberId, openCycle!.cycleId),
    getOrderDraft(memberId, openCycle!.cycleId),
  ]);
  // Unconfirmed edits to pick up, limited to the products still in the cycle.
  const resumedDraft = resumeDraft(
    storedDraft,
    existingLines,
    new Set(cycleProducts.map((p) => p.productId)),
  );

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
                  ? "bg-brand-teal text-white shadow-sm"
                  : "bg-white text-brand-gray border border-brand-border hover:bg-brand-warm-white"
              }`}
            >
              {c.title}
            </Link>
          ))}
        </div>
      )}
      <OrderForm
        // A new cycle is a new form: switching cycles must not carry over the
        // previous cycle's draft and saved quantities (client state survives
        // a search-param navigation).
        key={openCycle!.cycleId}
        cycleId={openCycle!.cycleId}
        cycleTitle={openCycle!.title}
        supplierName={openCycle!.supplierName}
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
        resumedDraft={resumedDraft}
        balance={balance}
        saveAction={saveOrder}
      />
    </AppShell>
  );
}

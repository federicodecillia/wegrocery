import { getAllCycles, getAllSuppliers, getLastHandlingFee, getOpenCycles, getOpenCycleStats } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { brand } from "@/lib/brand";
import { cardCyclesSelectable } from "@/lib/payments/cycle-mode";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getSettlementStatus, type SettlementStatus } from "@/lib/payments/settlement-store";
import { DEFAULT_HANDLING_FEE } from "@/lib/payments/order-payment";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { AdminInsights } from "./admin-insights";
import {
  ClosedCycleEditButton,
  CreateCycleForm,
  OpenCycleCard,
  SupplierActionsButton,
} from "./ciclo-forms";
import { CancelCycleButton } from "./cancel-cycle-dialog";
import { SettleCycleButton } from "./settle-cycle-dialog";
import { ClosedCycleDetails } from "./closed-cycle-details";

export async function TabCiclo() {
  const [openCycles, cycles, suppliers, settings] = await Promise.all([
    getOpenCycles(true),
    getAllCycles(15),
    getAllSuppliers(),
    getPaymentSettings(),
  ]);
  // Each new cycle starts from the last fee of the same payment mode: none in
  // wallet mode, 10% per order, until one is set. A wallet group may also pay
  // a single cycle by card (lib/payments/cycle-mode.ts).
  const cardSelectable = cardCyclesSelectable({
    groupMode: settings.mode,
    stripeUsable: settings.stripeKey.usable,
    currency: brand.currency,
  });
  const [lastWalletFee, lastCardFee] = await Promise.all([
    settings.mode === "wallet" ? getLastHandlingFee("wallet") : null,
    settings.mode === "per_order" || cardSelectable ? getLastHandlingFee("per_order") : null,
  ]);
  const feeInput = (fee: { type: "percent" | "fixed"; value: number } | null) =>
    fee && { type: fee.type, value: String(fee.value) };

  // Where each closed or cancelled pay-per-order cycle stands.
  const settlementStatus = new Map<string, SettlementStatus>(
    await Promise.all(
      cycles
        .filter((c) => c.paymentMode === "per_order" && (c.status === "closed" || c.status === "cancelled"))
        .map(async (c) => [c.cycleId, await getSettlementStatus(getDb(), c.cycleId)] as const),
    ),
  );

  const statsMap = new Map();
  const now = new Date();
  await Promise.all(
    openCycles.map(async (c) => {
      const stats = await getOpenCycleStats(c.cycleId);
      statsMap.set(c.cycleId, stats);
    })
  );

  return (
    <div>
      <AdminInsights />
      {openCycles.length > 0 ? (
        <div className="mb-4 space-y-4">
          {openCycles.map((openCycle) => {
            const stats = statsMap.get(openCycle.cycleId);
            return (
              <OpenCycleCard
                key={openCycle.cycleId}
                cycle={{
                  cycleId: openCycle.cycleId,
                  title: openCycle.title,
                  orderCloseAt: openCycle.orderCloseAt?.toISOString() ?? null,
                  pickupDate: openCycle.pickupDate?.toISOString() ?? null,
                  pickupEndTime: openCycle.pickupEndTime ?? null,
                  pickup2Date: openCycle.pickup2Date?.toISOString() ?? null,
                  pickup2EndTime: openCycle.pickup2EndTime ?? null,
                  notes: openCycle.notes ?? null,
                  supplierId: openCycle.supplierId ?? null,
                  accessLevel: openCycle.accessLevel,
                  isOverdue: openCycle.orderCloseAt ? openCycle.orderCloseAt < now : false,
                  shippingMode: openCycle.shippingMode ?? "fixed_per_member",
                  shippingCostPerMember: openCycle.shippingCostPerMember ?? null,
                  shippingTotal: openCycle.shippingTotal ?? null,
                  paymentMode: openCycle.paymentMode,
                  handlingFeeType: openCycle.handlingFeeType,
                  handlingFeeValue: openCycle.handlingFeeValue,
                }}
                stats={{
                  orderCount: stats?.orderCount ?? 0,
                  grandTotal: stats?.grandTotal ?? 0,
                  unpaidDrafts: stats?.unpaidDrafts ?? 0,
                  pendingPayments: stats?.pendingPayments ?? 0,
                }}
                suppliers={suppliers}
              />
            );
          })}
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-brand-border p-4 text-center text-[13px] text-brand-gray">
          {t.admin.cycle.noCycleOpen}
        </div>
      )}

      <CreateCycleForm
        suppliers={suppliers}
        paymentMode={settings.mode}
        cardSelectable={cardSelectable}
        walletFee={feeInput(lastWalletFee)}
        cardFee={feeInput(lastCardFee ?? DEFAULT_HANDLING_FEE)}
      />

      {cycles.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <h3 className="text-[13px] font-bold text-brand-near-black">{t.admin.cycle.recentCycles}</h3>
          </CardHeader>
          <div className="divide-y divide-brand-border">
            {cycles.map((c) => (
              <div key={c.cycleId} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {/* Status pill on the LEFT so it reads as a label, not a button —
                      visually separated from the action buttons on the right. */}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-label font-bold uppercase tracking-wide ${
                      c.status === "open"
                        ? "bg-accent-soft text-accent-text"
                        : c.status === "cancelled"
                          ? "bg-brand-red-light text-brand-red"
                          : "bg-black/[0.05] text-brand-gray"
                    }`}
                  >
                    {c.status === "open"
                      ? t.admin.cycle.openBadge
                      : c.status === "cancelled"
                        ? t.admin.cycle.cancelledBadge
                        : t.admin.cycle.closedBadge}
                  </span>
                  {c.paymentMode === "per_order" && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-label font-semibold text-primary-text">
                      💳 {t.admin.cycle.cardBadge}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-brand-near-black">{c.title}</div>
                    <div className="mt-0.5 font-mono text-label leading-tight text-muted">
                      {c.supplierName ?? "—"}
                      {c.pickupDate ? ` · ${formatDate(c.pickupDate)}` : ""}
                    </div>
                  </div>
                </div>
                {c.status === "closed" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ClosedCycleEditButton
                      cycle={{
                        cycleId: c.cycleId,
                        title: c.title,
                        orderCloseAt: c.orderCloseAt?.toISOString() ?? null,
                        pickupDate: c.pickupDate?.toISOString() ?? null,
                        pickupEndTime: c.pickupEndTime ?? null,
                        pickup2Date: c.pickup2Date?.toISOString() ?? null,
                        pickup2EndTime: c.pickup2EndTime ?? null,
                        notes: c.notes ?? null,
                        supplierId: c.supplierId ?? null,
                        accessLevel: c.accessLevel,
                        isOverdue: false,
                        shippingMode: c.shippingMode ?? "fixed_per_member",
                        shippingCostPerMember: c.shippingCostPerMember ?? null,
                        shippingTotal: c.shippingTotal ?? null,
                        status: c.status,
                      }}
                      suppliers={suppliers}
                    />
                    <SupplierActionsButton
                      cycleId={c.cycleId}
                      cycleTitle={c.title}
                      supplierName={c.supplierName ?? null}
                      supplierEmail={c.supplierEmail ?? null}
                    />
                    <ClosedCycleDetails cycleId={c.cycleId} cycleTitle={c.title} />
                    <CancelCycleButton cycleId={c.cycleId} cycleTitle={c.title} />
                    {settlementStatus.has(c.cycleId) && (
                      <SettleCycleButton
                        cycleId={c.cycleId}
                        cycleTitle={c.title}
                        settledAt={c.settledAt?.toISOString() ?? null}
                        status={settlementStatus.get(c.cycleId)!}
                      />
                    )}
                  </div>
                )}
                {c.status === "cancelled" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ClosedCycleDetails cycleId={c.cycleId} cycleTitle={c.title} />
                    {settlementStatus.has(c.cycleId) && (
                      <SettleCycleButton
                        cycleId={c.cycleId}
                        cycleTitle={c.title}
                        settledAt={c.settledAt?.toISOString() ?? null}
                        status={settlementStatus.get(c.cycleId)!}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

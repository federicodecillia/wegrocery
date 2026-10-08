import Link from "next/link";
import { getAllCycles, getAllSuppliers, getLastHandlingFee, getOpenCycleStats } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { brand } from "@/lib/brand";
import { cardCyclesSelectable } from "@/lib/payments/cycle-mode";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getSettlementStatus } from "@/lib/payments/settlement-store";
import { DEFAULT_HANDLING_FEE } from "@/lib/payments/order-payment";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { formatDeadline } from "@/lib/i18n/deadline";
import { adminHref } from "@/lib/admin/nav";
import { CYCLE_VIEW_LABELS, cycleViews, defaultCycleId, resolveCycleView, type CycleView } from "@/lib/admin/cycle-views";
import { AdminInsights } from "./admin-insights";
import {
  CloseCycleAction,
  CreateCycleForm,
  CycleFacts,
  CycleProductsView,
  EditCycleButton,
  OpenCycleOverview,
  OrdersLink,
  SupplierActionsButton,
  type SerializedCycle,
} from "./ciclo-forms";
import { CancelCycleButton } from "./cancel-cycle-dialog";
import { SettleCycleButton } from "./settle-cycle-dialog";
import { CycleList, CyclePicker, type CycleListItem } from "./cycle-list";
import { CycleOrdersView } from "./cycle-orders-view";

type Props = {
  cycleId?: string;
  view: CycleView | null;
  /** "+ Nuovo ciclo": the creation form, open. */
  creating: boolean;
};

// Admin → Ciclo: one cycle at a time. On the left (a sheet on a phone) every
// cycle, then the chosen one's header with its main action, and its views:
// Panoramica · Prodotti · Ordini while open, Panoramica · Ordini · Fornitore ·
// Conti once closed.
export async function CycleWorkspace({ cycleId: asked, view: askedView, creating }: Props) {
  const [cycles, suppliers, settings] = await Promise.all([getAllCycles(1000), getAllSuppliers(), getPaymentSettings()]);
  const selectedId = creating ? null : defaultCycleId(cycles, asked);
  const cycle = cycles.find((c) => c.cycleId === selectedId) ?? null;
  const view = cycle ? resolveCycleView(cycle.status, askedView) : null;

  const listItems: CycleListItem[] = cycles.map((c) => ({
    cycleId: c.cycleId,
    title: c.title,
    status: c.status,
    perOrder: c.paymentMode === "per_order",
    date: (c.status === "open" ? c.orderCloseAt : (c.pickupDate ?? c.createdAt))?.toISOString() ?? null,
  }));

  return (
    <div>
      <AdminInsights />
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
        <aside aria-label={t.admin.workspace.listTitle} className="hidden lg:block">
          <CycleList cycles={listItems} selectedId={selectedId} view={view} />
        </aside>
        <div className="min-w-0">
          <CyclePicker cycles={listItems} selectedId={selectedId} view={view} />
          {cycle && view ? (
            <SelectedCycle cycle={cycle} view={view} suppliers={suppliers} />
          ) : (
            <NewCycle suppliers={suppliers} settings={settings} empty={cycles.length === 0} />
          )}
        </div>
      </div>
    </div>
  );
}

async function NewCycle({
  suppliers,
  settings,
  empty,
}: {
  suppliers: { supplierId: string; name: string }[];
  settings: Awaited<ReturnType<typeof getPaymentSettings>>;
  empty: boolean;
}) {
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
  return (
    <div>
      {empty && <p className="mb-3 text-[13px] text-brand-gray">{t.admin.workspace.noCycles}</p>}
      <CreateCycleForm
        suppliers={suppliers}
        paymentMode={settings.mode}
        cardSelectable={cardSelectable}
        walletFee={feeInput(lastWalletFee)}
        cardFee={feeInput(lastCardFee ?? DEFAULT_HANDLING_FEE)}
        defaultOpen
      />
    </div>
  );
}

type FullCycle = Awaited<ReturnType<typeof getAllCycles>>[number];

function serialize(c: FullCycle): SerializedCycle {
  return {
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
    isOverdue: c.status === "open" && c.orderCloseAt ? c.orderCloseAt < new Date() : false,
    shippingMode: c.shippingMode ?? "fixed_per_member",
    shippingCostPerMember: c.shippingCostPerMember ?? null,
    shippingTotal: c.shippingTotal ?? null,
    status: c.status,
    paymentMode: c.paymentMode,
    handlingFeeType: c.handlingFeeType,
    handlingFeeValue: c.handlingFeeValue,
  };
}

async function SelectedCycle({
  cycle: c,
  view,
  suppliers,
}: {
  cycle: FullCycle;
  view: CycleView;
  suppliers: { supplierId: string; name: string }[];
}) {
  const cycle = serialize(c);
  const w = t.admin.workspace;
  const isOpen = c.status === "open";
  const perOrder = c.paymentMode === "per_order";
  const [rawStats, settlement] = await Promise.all([
    isOpen ? getOpenCycleStats(c.cycleId) : null,
    perOrder && !isOpen ? getSettlementStatus(getDb(), c.cycleId) : null,
  ]);
  const stats = {
    orderCount: rawStats?.orderCount ?? 0,
    grandTotal: rawStats?.grandTotal ?? 0,
    unpaidDrafts: rawStats?.unpaidDrafts ?? 0,
    pendingPayments: rawStats?.pendingPayments ?? 0,
  };

  const when = isOpen
    ? c.orderCloseAt && w.closesAt(formatDeadline(c.orderCloseAt))
    : c.closedAt && w.closedAt(formatDate(c.closedAt));

  return (
    <section aria-labelledby="cycle-title">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge tone={isOpen ? "accent" : c.status === "cancelled" ? "danger" : "neutral"} dot={isOpen}>
              {isOpen ? t.admin.cycle.openBadge : c.status === "cancelled" ? t.admin.cycle.cancelledBadge : t.admin.cycle.closedBadge}
            </Badge>
            {perOrder && <Badge tone="brand">💳 {t.admin.cycle.cardBadge}</Badge>}
          </div>
          <h2 id="cycle-title" className="text-[18px] font-black text-brand-near-black">
            {c.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-brand-gray">
            {[c.supplierName, when].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status !== "cancelled" && <EditCycleButton cycle={cycle} suppliers={suppliers} />}
          {isOpen && <CloseCycleAction cycle={cycle} stats={stats} />}
        </div>
      </header>

      <nav aria-label={t.admin.nav.views} className="mb-4 flex gap-4 overflow-x-auto border-b border-brand-border px-1 [scrollbar-width:none]">
        {cycleViews(c.status).map((v) => (
          <Link
            key={v}
            href={adminHref("ciclo", v, { cycle: c.cycleId })}
            aria-current={view === v ? "page" : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center border-b-2 text-[14px] font-semibold ${
              view === v ? "border-primary text-brand-near-black" : "border-transparent text-brand-gray hover:text-brand-near-black"
            }`}
          >
            {CYCLE_VIEW_LABELS[v]}
          </Link>
        ))}
      </nav>

      {view === "panoramica" &&
        (isOpen ? (
          <OpenCycleOverview cycle={cycle} stats={stats} />
        ) : (
          <Card>
            <CardBody>
              <CycleFacts cycle={cycle} />
              <div className="mt-3">
                <OrdersLink cycleId={c.cycleId} />
              </div>
            </CardBody>
          </Card>
        ))}

      {view === "prodotti" && <CycleProductsView cycle={cycle} suppliers={suppliers} />}

      {view === "ordini" && <CycleOrdersView cycleId={c.cycleId} cycleTitle={c.title} editable={c.status === "closed"} />}

      {view === "fornitore" && (
        <Card>
          <CardBody>
            <p className="mb-3 max-w-prose text-[13px] text-brand-gray">{w.supplierIntro}</p>
            <SupplierActionsButton
              cycleId={c.cycleId}
              cycleTitle={c.title}
              supplierName={c.supplierName ?? null}
              supplierEmail={c.supplierEmail ?? null}
            />
          </CardBody>
        </Card>
      )}

      {view === "conti" && (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <p className="mb-3 max-w-prose text-[13px] text-brand-gray">{settlement ? w.accountsIntro : w.nothingToSettle}</p>
              {settlement && (
                <SettleCycleButton
                  cycleId={c.cycleId}
                  cycleTitle={c.title}
                  settledAt={c.settledAt?.toISOString() ?? null}
                  status={settlement}
                />
              )}
            </CardBody>
          </Card>
          {c.status === "closed" && (
            <Card className="border-brand-red/30">
              <CardBody>
                <h3 className="text-[14px] font-bold text-brand-red">{w.dangerZone}</h3>
                <p className="mt-1 mb-3 max-w-prose text-[13px] text-brand-gray">{w.cancelIntro}</p>
                <CancelCycleButton cycleId={c.cycleId} cycleTitle={c.title} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

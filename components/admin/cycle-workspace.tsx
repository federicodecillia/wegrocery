import Link from "next/link";
import {
  getAllCycles,
  getAllMembers,
  getAllSuppliers,
  getCycleTaskFacts,
  getDismissedDuplicatePairs,
  getLastHandlingFee,
  getOpenCycleStats,
  getRequestedRefundCount,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { brand } from "@/lib/brand";
import { cardCyclesAvailable, cardCyclesSelectable, defaultNewCycleMode } from "@/lib/payments/cycle-mode";
import { startingFee } from "@/lib/payments/new-cycle-defaults";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getSettlementStatus } from "@/lib/payments/settlement-store";
import { DEFAULT_HANDLING_FEE } from "@/lib/payments/order-payment";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { formatDeadline } from "@/lib/i18n/deadline";
import { adminHref } from "@/lib/admin/nav";
import { CYCLE_VIEW_LABELS, cycleViews, defaultCycleId, resolveCycleView, settlementCandidate, settlementPending, supplierOrderReady, viewsFor, type CycleView } from "@/lib/admin/cycle-views";
import { CycleTodo } from "./cycle-todo";
import { TASK_WINDOW_DAYS, cycleTasks } from "@/lib/admin/cycle-phase";
import { findDuplicatePairs } from "@/lib/members/duplicates";
import { managesCycle } from "@/lib/auth/manager";
import { ACCESS_LEVELS, type Role } from "@/lib/roles";
import { AccessLevelsProvider } from "./access-levels";
import {
  CloseCycleAction,
  CreateCycleForm,
  CycleFacts,
  CycleProductsView,
  EditCycleButton,
  OpenCycleOverview,
  OrdersLink,
  type SerializedCycle,
} from "./ciclo-forms";
import { CycleAccountsView } from "./cycle-accounts-view";
import { SupplierSteps } from "./supplier-steps";
import { CycleList, CyclePicker, type CycleListItem, type SettleState } from "./cycle-list";
import { CycleOrdersView } from "./cycle-orders-view";
import { CyclePickupsView } from "./cycle-pickups-view";
import { RichText } from "@/components/guide/rich-text";
import { getCyclePickups } from "@/lib/db/pickups";
import { pickupProgressLabel } from "@/lib/pickups";

type Props = {
  cycleId?: string;
  view: CycleView | null;
  /** "+ Nuovo ciclo": the creation form, open. */
  creating: boolean;
  /** "referent": a "Referente ordini", on the cycles their role sees, without the accounts. */
  access?: "admin" | "referent";
  /** The session's role: the cycles a referent sees and the levels they may give. */
  role?: Role | null;
};

// Admin → Ciclo: one cycle at a time. On the left (on a phone or tablet, a
// sheet opened from the top row, next to "+ Nuovo ciclo") every cycle, then
// the chosen one's header with its main action, and its views: Panoramica · Prodotti · Ordini · Ritiri while open (plus Fornitore past the order
// deadline), Panoramica · Ordini · Fornitore · Ritiri · Conti once closed.
export async function CycleWorkspace({ cycleId: asked, view: askedView, creating, access = "admin", role = null }: Props) {
  const referent = access === "referent";
  const [allCycles, suppliers, settings] = await Promise.all([getAllCycles(1000), getAllSuppliers(), getPaymentSettings()]);
  // A referent sees the cycles their role sees as a member, nothing more.
  const cycles = referent ? allCycles.filter((c) => managesCycle({ access, role }, c.accessLevel)) : allCycles;
  const accessLevels = ACCESS_LEVELS.filter((level) => managesCycle({ access, role }, level));
  const selectedId = creating ? null : defaultCycleId(cycles, asked);
  const cycle = cycles.find((c) => c.cycleId === selectedId) ?? null;
  const view = cycle ? resolveCycleView(cycle.status, askedView, supplierOrderReady(cycle.status, cycle.orderCloseAt), access) : null;

  // Card cycles closed or cancelled, unsettled or settled lately: whether
  // their accounts still ask for "Chiudi i conti" (a correction or a failed
  // refund can reopen a settled one).
  const now = new Date();
  const settleStates = new Map(
    await Promise.all(
      cycles
        // The accounts are the admins': a referent is not asked to settle.
        .filter((c) => !referent && settlementCandidate(c, now))
        .map(async (c) => [c.cycleId, await getSettlementStatus(getDb(), c.cycleId)] as const),
    ),
  );

  const listItems: CycleListItem[] = cycles.map((c) => {
    const status = settleStates.get(c.cycleId) ?? null;
    const settle = settlementPending(status) ? (status as SettleState) : null;
    return {
      cycleId: c.cycleId,
      title: c.title,
      status: c.status,
      perOrder: c.paymentMode === "per_order",
      toSettle: settle != null,
      settle,
      date: (c.status === "open" ? c.orderCloseAt : (c.pickupDate ?? c.createdAt))?.toISOString() ?? null,
    };
  });

  // "Da fare ora": open cycles, cycles closed lately, card cycles to settle.
  const windowStart = now.getTime() - TASK_WINDOW_DAYS * 86_400_000;
  const inScope = cycles.filter(
    (c) =>
      c.status === "open" ||
      (c.closedAt != null && c.closedAt.getTime() >= windowStart) ||
      settlementPending(settleStates.get(c.cycleId) ?? null),
  );
  const [taskFacts, refunds, allMembers, dismissed] = await Promise.all([
    getCycleTaskFacts(inScope.map((c) => c.cycleId)),
    // Cassa and Soci are the admins': a referent gets neither nudge.
    referent ? 0 : getRequestedRefundCount(),
    referent ? [] : getAllMembers(),
    referent ? new Set<string>() : getDismissedDuplicatePairs(),
  ]);
  const tasks = cycleTasks(
    inScope.map((c) => {
      const f = taskFacts.get(c.cycleId);
      return {
        cycleId: c.cycleId,
        title: c.title,
        status: c.status,
        orderCloseAt: c.orderCloseAt,
        closedAt: c.closedAt,
        orderMembers: f?.orderMembers ?? 0,
        supplierSent: f?.supplierSent ?? false,
        adjusted: f?.adjusted ?? false,
        settlementPending: settlementPending(settleStates.get(c.cycleId) ?? null),
        pickupDate: c.pickupDate,
        pickedUp: f?.pickedUp ?? 0,
      };
    }),
    now,
  );
  // As in Soci: a person who joined a family is not a duplicate of anyone.
  const duplicates = findDuplicatePairs(
    allMembers.filter((m) => !m.householdOf),
    dismissed,
  ).length;

  return (
    <AccessLevelsProvider levels={accessLevels}>
    <div>
      <div className="mb-3 flex gap-2 lg:hidden">
        <div className="min-w-0 flex-1">
          <CyclePicker cycles={listItems} selectedId={selectedId} view={view} />
        </div>
        <Link
          href={adminHref("ciclo", null, { new: "1" })}
          className="flex min-h-11 shrink-0 items-center rounded-xl bg-inverse px-4 text-[13px] font-bold text-inverse-foreground"
        >
          {t.admin.workspace.newCycle}
        </Link>
      </div>
      {/* While creating, the form comes right under the top row: on a phone "+ Nuovo ciclo" must show it in view. */}
      {!creating && <CycleTodo tasks={tasks} refunds={refunds} duplicates={duplicates} />}
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
        <aside aria-label={t.admin.workspace.listTitle} className="hidden lg:block">
          <CycleList cycles={listItems} selectedId={selectedId} view={view} />
        </aside>
        <div className="min-w-0">
          {cycle && view ? (
            <SelectedCycle cycle={cycle} view={view} suppliers={suppliers} access={access} />
          ) : (
            <NewCycle suppliers={suppliers} settings={settings} empty={cycles.length === 0} />
          )}
        </div>
      </div>
    </div>
    </AccessLevelsProvider>
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
  // Each new cycle starts from the defaults of its payment mode set in
  // Impostazioni, else the last fee of that mode: none in wallet mode, 10% per
  // order, until one is set (lib/payments/new-cycle-defaults.ts). A wallet
  // group may also pay a single cycle by card, or start every new cycle by
  // card (lib/payments/cycle-mode.ts).
  const cardContext = {
    groupMode: settings.mode,
    stripeUsable: settings.stripeKey.usable,
    currency: brand.currency,
    cardCyclesEnabled: settings.cardCyclesEnabled,
    newCycleMode: settings.newCycleMode,
  };
  const cardSelectable = cardCyclesSelectable(cardContext);
  const cardSwitchedOff = cardCyclesAvailable(cardContext) && !settings.cardCyclesEnabled;
  const [lastWalletFee, lastCardFee] = await Promise.all([
    settings.mode === "wallet" ? getLastHandlingFee("wallet") : null,
    settings.mode === "per_order" || cardSelectable ? getLastHandlingFee("per_order") : null,
  ]);
  const defaults = settings.newCycleDefaults;
  const feeInput = (fee: { type: "percent" | "fixed"; value: number } | null) =>
    fee && { type: fee.type, value: String(fee.value) };
  return (
    <div>
      {empty && <p className="mb-3 text-[13px] text-secondary-foreground">{t.admin.workspace.noCycles}</p>}
      <CreateCycleForm
        suppliers={suppliers}
        paymentMode={defaultNewCycleMode(cardContext)}
        cardSelectable={cardSelectable}
        cardSwitchedOff={cardSwitchedOff}
        walletFee={feeInput(startingFee(defaults, "wallet", lastWalletFee))}
        cardFee={feeInput(startingFee(defaults, "per_order", lastCardFee) ?? DEFAULT_HANDLING_FEE)}
        walletShipping={defaults.wallet?.shipping ?? null}
        cardShipping={defaults.per_order?.shipping ?? null}
        cardDeposit={defaults.per_order?.depositPct ?? null}
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
    weighingDepositPct: c.weighingDepositPct,
  };
}

async function SelectedCycle({
  cycle: c,
  view,
  suppliers,
  access,
}: {
  cycle: FullCycle;
  view: CycleView;
  suppliers: { supplierId: string; name: string }[];
  access: "admin" | "referent";
}) {
  const cycle = serialize(c);
  const w = t.admin.workspace;
  const isOpen = c.status === "open";
  const perOrder = c.paymentMode === "per_order";
  const [rawStats, settlement, pickups] = await Promise.all([
    isOpen ? getOpenCycleStats(c.cycleId) : null,
    perOrder && !isOpen && access === "admin" ? getSettlementStatus(getDb(), c.cycleId) : null,
    c.status === "closed" ? getCyclePickups(c.cycleId) : [],
  ]);
  const collected = pickups.filter((p) => p.pickedUpAt).length;
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
            <Badge variant={isOpen ? "accent" : c.status === "cancelled" ? "destructive" : "default"} dot={isOpen}>
              {isOpen ? t.admin.cycle.openBadge : c.status === "cancelled" ? t.admin.cycle.cancelledBadge : t.admin.cycle.closedBadge}
            </Badge>
            {perOrder && <Badge variant="brand">💳 {t.admin.cycle.cardBadge}</Badge>}
            {pickups.length > 0 && (
              // The pickup counter: a link to Ritiri, so not a Badge (a status, never clickable).
              <Link
                href={adminHref("ciclo", "ritiri", { cycle: c.cycleId })}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-label font-semibold tabular-nums underline-offset-2 hover:underline ${
                  collected >= pickups.length ? "border-accent/20 bg-accent-bg text-accent-text" : "border-border bg-tint/[0.04] text-secondary-foreground"
                }`}
              >
                📦 {pickupProgressLabel({ done: collected, total: pickups.length })}
              </Link>
            )}
          </div>
          <h2 id="cycle-title" className="text-[18px] font-black text-foreground">
            {c.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-secondary-foreground">
            {[c.supplierName, when].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status !== "cancelled" && <EditCycleButton cycle={cycle} suppliers={suppliers} />}
          {isOpen && <CloseCycleAction cycle={cycle} stats={stats} />}
        </div>
      </header>

      <nav aria-label={t.admin.nav.views} className="mb-4 flex gap-4 overflow-x-auto border-b border-border px-1 [scrollbar-width:none]">
        {viewsFor(cycleViews(c.status, supplierOrderReady(c.status, c.orderCloseAt)), access).map((v) => (
          <Link
            key={v}
            href={adminHref("ciclo", v, { cycle: c.cycleId })}
            aria-current={view === v ? "page" : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center border-b-2 text-[14px] font-semibold ${
              view === v ? "border-primary text-foreground" : "border-transparent text-secondary-foreground hover:text-foreground"
            }`}
          >
            {CYCLE_VIEW_LABELS[v]}
          </Link>
        ))}
      </nav>

      {view === "panoramica" &&
        (isOpen ? (
          <OpenCycleOverview cycle={cycle} stats={stats} suppliers={suppliers} />
        ) : (
          <Card>
            <CardContent>
              <CycleFacts cycle={cycle} suppliers={suppliers} />
              <div className="mt-3">
                <OrdersLink cycleId={c.cycleId} />
              </div>
            </CardContent>
          </Card>
        ))}

      {view === "prodotti" && <CycleProductsView cycle={cycle} suppliers={suppliers} />}

      {view === "ordini" && <CycleOrdersView cycleId={c.cycleId} cycleTitle={c.title} cycleStatus={c.status} />}

      {view === "fornitore" &&
        (c.supplierName ? (
          <div>
            <p className="mb-3 max-w-prose text-[13px] text-secondary-foreground">{isOpen ? w.supplierIntroOpen : w.supplierIntro}</p>
            <SupplierSteps cycleId={c.cycleId} cycleOpen={isOpen} />
          </div>
        ) : (
          <Card>
            <CardContent>
              <p className="max-w-prose text-[13px] text-secondary-foreground">{w.noSupplier}</p>
            </CardContent>
          </Card>
        ))}

      {view === "ritiri" &&
        (isOpen ? (
          <Card>
            <CardContent>
              <h3 className="text-[14px] font-bold text-foreground">{t.admin.pickups.openTitle}</h3>
              <p className="mt-1 mb-3 max-w-prose text-[13px] text-secondary-foreground">
                <RichText text={t.admin.pickups.openHint} />
              </p>
              <CloseCycleAction cycle={cycle} stats={stats} />
            </CardContent>
          </Card>
        ) : (
          <CyclePickupsView cycleId={c.cycleId} rows={pickups} />
        ))}

      {view === "conti" && (
        <CycleAccountsView
          cycle={cycle}
          settledAt={c.settledAt?.toISOString() ?? null}
          settlement={settlement}
          // Warned only where the register is in use: a group that never marks pickups is not nagged.
          notCollected={collected > 0 ? pickups.length - collected : 0}
        />
      )}
    </section>
  );
}

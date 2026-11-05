import { adminAccess } from "@/lib/auth/access";
import { AppShell } from "@/components/app-shell";
import { BalanceDueCard } from "@/components/balance/balance-due-card";
import { CycleRow, CycleRows } from "@/components/home/cycle-row";
import { HomeMonth } from "@/components/home/home-month";
import { HomeSection } from "@/components/home/home-section";
import { OpenCycleCard } from "@/components/home/open-cycle-card";
import { HomeBalance } from "@/components/home/home-balance";
import { InstallPrompt } from "@/components/install-prompt";
import { MovementRow } from "@/components/movement-row";
import { WelcomeCard } from "@/components/home/welcome-card";
import { SetupBanner } from "@/components/admin/setup/setup-banner";
import { getBrand } from "@/lib/brand/get-brand";
import { isWelcomeStep, WELCOME_QUERY, welcomeDone, welcomeMoney } from "@/lib/guide/welcome";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberById,
  getWelcomeFacts,
  getMemberLedger,
  getFamilyMemberIds,
  getMemberOrderLines,
  getOpenCycles,
  getOrderDraft,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { getCalendarCycles } from "@/lib/db/calendar";
import { buildCalendar, dayOf } from "@/lib/calendar";
import { homeGroups } from "@/lib/home";
import { formatLongDay, formatPickupLong } from "@/lib/i18n/deadline";
import { getConsolidatedBalanceCents, getWalletBalance, getWalletOffset } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getCycleCoverageCents } from "@/lib/payments/order-confirm";
import {
  cycleHandlingFee,
  cycleWeighingDeposit,
  handlingFeeCents,
  homeOrderStatus,
  orderPaymentAmount,
  type HomeOrderStatus,
} from "@/lib/payments/order-payment";
import { formatEur, memberProductEmoji } from "@/lib/utils";
import { canAccessCycle } from "@/lib/roles";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const brand = await getBrand();
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;
  const personId = session.user.personId ?? memberId;

  const [openCycles, recentMovements, settings, member, calendarRows] = await Promise.all([
    getOpenCycles(),
    getMemberLedger(memberId, 3),
    getPaymentSettings(),
    getMemberById(memberId),
    // The calendar section: the family's orders count, as in /calendario.
    getFamilyMemberIds(memberId).then((ids) => getCalendarCycles(role, ids)),
  ]);
  const now = new Date();
  // The welcome card is personal: the person who signed in, not the family
  // account they shop on.
  const person = personId === memberId ? member : await getMemberById(personId);
  const reopenWelcome = (await searchParams)[WELCOME_QUERY] === "1";
  const showWelcome = reopenWelcome || (person !== null && person.welcomeDismissedAt === null);
  // What the card ticks comes from real rows, only read while it shows.
  const welcomeDoneSteps = showWelcome ? welcomeDone(await getWelcomeFacts(memberId, personId)) : [];
  const welcomeSavedStep = person !== null && isWelcomeStep(person.welcomeStep) ? person.welcomeStep : null;
  // A pay-per-order group has no wallet: no balance card, each cycle says
  // where its order stands, and the amount due or the credit comes first. A
  // member who pays outside the app keeps the wallet view.
  const payPerOrder = settings.mode === "per_order" && !member?.paysOffline;
  // A wallet group may switch top-ups off: the balance stays, without "Ricarica".
  const topups = settings.mode !== "wallet" || settings.walletTopupsEnabled;
  const consolidatedCents = payPerOrder ? await getConsolidatedBalanceCents(getDb(), memberId) : 0;
  // A wallet group's balance leaves out the card cycles not settled yet.
  const balance = payPerOrder ? 0 : await getWalletBalance(getDb(), memberId, member?.paysOffline ?? false);
  // A cycle paid by card (the group's mode, or one card cycle in a wallet
  // group) is confirmed by paying it, unless the member pays outside the app.
  const paidByCard = (cycle: { paymentMode: string }) => cycle.paymentMode === "per_order" && !member?.paysOffline;

  const activeCycles = openCycles.filter((c) => canAccessCycle(c.accessLevel, role));
  // The wallet debt or credit a card payment counts (app_settings.card_settles_wallet).
  const wallet = activeCycles.some(paidByCard)
    ? await getWalletOffset(getDb(), memberId, {
        enabled: settings.cardSettlesWallet,
        paysOffline: member?.paysOffline ?? false,
      })
    : undefined;

  const cycleDataList = await Promise.all(
    activeCycles.map(async (cycle) => {
      const [cycleProducts, myLines] = await Promise.all([
        getCycleProducts(cycle.cycleId),
        getMemberOrderLines(memberId, cycle.cycleId),
      ]);
      const orderTotal = myLines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
      // The order preparation fee a wallet member will be charged at the close (estimate).
      const feeCents = paidByCard(cycle) ? 0 : handlingFeeCents(Math.round(orderTotal * 100), cycleHandlingFee(cycle));
      return { cycle, cycleProducts, myLines, orderTotal, feeCents, payStatus: await payStatusOf(cycle, cycleProducts, myLines.length > 0) };
    })
  );

  async function payStatusOf(
    cycle: (typeof activeCycles)[number],
    cycleProducts: { productId: string; unitPrice: string }[],
    hasConfirmedOrder: boolean,
  ): Promise<HomeOrderStatus> {
    const feeType = cycle.handlingFeeType;
    if (!paidByCard(cycle) || (feeType !== "percent" && feeType !== "fixed") || cycle.handlingFeeValue === null) {
      return null;
    }
    const [coveredCents, draftLines] = await Promise.all([
      getCycleCoverageCents(getDb(), memberId, cycle.cycleId),
      getOrderDraft(memberId, cycle.cycleId),
    ]);
    const prices = new Map(cycleProducts.map((p) => [p.productId, Math.round(Number(p.unitPrice) * 100)]));
    const draft = draftLines
      ? orderPaymentAmount({
          productsCents: draftLines.reduce((sum, l) => sum + (prices.get(l.productId) ?? 0) * l.quantity, 0),
          shipping: {
            mode: cycle.shippingMode,
            fixedCents: cycle.shippingCostPerMember === null ? null : Math.round(Number(cycle.shippingCostPerMember) * 100),
          },
          fee: { type: feeType, value: Number(cycle.handlingFeeValue) },
          coveredCents,
          wallet,
          depositPct: cycleWeighingDeposit(cycle),
        })
      : null;
    return homeOrderStatus({ hasConfirmedOrder, draft, coveredCents });
  }

  // Only what the wallet will pay: a card cycle's order is paid already.
  const globalOrderTotal = cycleDataList
    .filter((d) => !paidByCard(d.cycle))
    .reduce((sum, d) => sum + (isNaN(d.orderTotal) ? 0 : d.orderTotal + d.feeCents / 100), 0);
  const afterBalance = (balance || 0) - globalOrderTotal;

  const today = dayOf(now);
  const entries = buildCalendar(calendarRows, now);
  const { toCollect, comingUp } = homeGroups(entries);
  // What the member ordered on each cycle still to collect (the row's second line).
  const collectOrders = new Map(
    await Promise.all(
      toCollect.map(async (e) => {
        const lines = await getMemberOrderLines(memberId, e.cycleId);
        return [e.cycleId, { count: lines.length, total: lines.reduce((s, l) => s + parseFloat(l.lineTotal), 0) }] as const;
      }),
    ),
  );
  const firstDay = (e: (typeof entries)[number], kind: "opens" | "closes" | "pickup") => e.events.find((x) => x.kind === kind) ?? null;
  const negative = !payPerOrder && balance < 0;

  // One list of cycles, each once, by what the member has to do next.
  const toOrderBlock = (
    <HomeSection id="da-ordinare" title={t.home.sectionToOrder} action={{ href: "/calendario", label: t.home.fullCalendar, mobileOnly: true }}>
      {cycleDataList.length === 0 ? (
        <div className="rounded-card border border-border bg-card px-4 py-3.5 shadow-card">
          <p className="text-[15px] font-semibold text-foreground">{t.home.noOpenNow}</p>
          <p className="text-[14px] text-secondary-foreground">
            {comingUp[0] && firstDay(comingUp[0], "opens")
              ? t.home.nextOpens(formatLongDay(firstDay(comingUp[0], "opens")!.at), comingUp[0].title)
              : t.home.weNotify}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycleDataList.map(({ cycle, cycleProducts, myLines, orderTotal, payStatus }) => {
            const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));
            return (
              <OpenCycleCard
                key={cycle.cycleId}
                today={today}
                cycle={{
                  cycleId: cycle.cycleId,
                  title: cycle.title,
                  supplierName: cycle.supplierName,
                  notes: cycle.notes,
                  orderCloseAt: new Date(cycle.orderCloseAt ?? now).toISOString(),
                  pickups: [
                    cycle.pickupDate && { date: new Date(cycle.pickupDate).toISOString(), endTime: cycle.pickupEndTime ?? null },
                    cycle.pickup2Date && { date: new Date(cycle.pickup2Date).toISOString(), endTime: cycle.pickup2EndTime ?? null },
                  ].filter((x): x is { date: string; endTime: string | null } => Boolean(x)),
                  pickupTentative: cycle.pickupTentative,
                }}
                payStatus={payStatus}
                lines={myLines.map((line) => {
                  const p = productMap.get(line.productId);
                  return {
                    id: line.orderLineId,
                    name: p?.name ?? "?",
                    detail: [p?.variant, p?.format].filter(Boolean).join(" · ") || null,
                    emoji: memberProductEmoji(p?.emoji, p?.name ?? ""),
                    quantity: line.quantity,
                    total: parseFloat(line.lineTotal),
                  };
                })}
                orderTotal={orderTotal}
              />
            );
          })}
        </div>
      )}
    </HomeSection>
  );

  const toCollectBlock = toCollect.length > 0 && (
    <HomeSection id="da-ritirare" title={t.home.sectionToCollect}>
      <CycleRows>
        {toCollect.map((e) => {
          const pickup = firstDay(e, "pickup");
          const order = collectOrders.get(e.cycleId);
          return (
            <CycleRow
              key={e.cycleId}
              href={`/storico?cycleId=${encodeURIComponent(e.cycleId)}`}
              day={pickup?.day ?? null}
              tone={pickup && pickup.day === today ? "urgent" : "neutral"}
              title={e.title}
              when={pickup ? (e.pickupTentative ? t.home.pickupExpected : t.home.pickupOn)(formatPickupLong(pickup.at, pickup.endTime)) : t.home.pickupTbd}
              detail={order && order.count > 0 ? t.home.ordered(order.count, formatEur(order.total)) : null}
            />
          );
        })}
      </CycleRows>
    </HomeSection>
  );

  const comingUpBlock = comingUp.length > 0 && (
    <HomeSection id="in-arrivo" title={t.home.sectionComingUp}>
      <CycleRows>
        {comingUp.map((e) => {
          const opens = firstDay(e, "opens");
          return (
            <CycleRow
              key={e.cycleId}
              href="/calendario"
              day={opens?.day ?? null}
              tone="neutral"
              title={e.title}
              when={opens ? t.home.opensOn(formatLongDay(opens.at)) : t.calendar.states.planned}
              detail={e.supplierName}
              badge={e.tentative ? t.calendar.tentative : t.calendar.states.planned}
            />
          );
        })}
      </CycleRows>
    </HomeSection>
  );

  const balanceCard = !payPerOrder && (
    <HomeBalance
      balance={balance}
      afterOrders={globalOrderTotal > 0 ? afterBalance : null}
      feeIncluded={cycleDataList.some((d) => d.feeCents > 0)}
      topups={topups}
      cardSettlesWallet={settings.cardSettlesWallet}
      supportEmail={brand.supportEmail}
    />
  );

  // Money last (card payments keep the balance near zero), except a negative
  // balance, which goes on top.
  const moneyBlock = (
    <HomeSection
      id="saldo"
      title={t.home.sectionMoney}
      action={recentMovements.length > 0 ? { href: "/storico?tab=movimenti", label: t.home.seeAll } : undefined}
    >
      {!negative && balanceCard}
      {recentMovements.map((e) => (
        <MovementRow key={e.entryId} entry={e} href="/storico?tab=movimenti" />
      ))}
    </HomeSection>
  );
  const showMoney = (!payPerOrder && !negative) || recentMovements.length > 0;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} admin={adminAccess(session.user)} memberId={memberId} personId={session.user.personId} layout="wide">
      <h1 className="sr-only">{t.nav.home}</h1>
      {role === "admin" && <SetupBanner />}
      {showWelcome && (
        <WelcomeCard
          appName={brand.appName}
          money={welcomeMoney(settings.mode, member?.paysOffline ?? false, settings.walletTopupsEnabled)}
          families={settings.familiesEnabled}
          hasGroupInfo={settings.groupInfo !== null}
          reopened={reopenWelcome}
          savedStep={welcomeSavedStep}
          done={welcomeDoneSteps}
        />
      )}

      {/* An amount due comes first: until it is paid no card order can be confirmed. */}
      {payPerOrder && <BalanceDueCard cents={consolidatedCents} canPay={settings.onlineTopupAvailable} />}

      {negative && balanceCard}

      {/* One list of cycles by what to do (order, collect, coming up), then the
          money. From lg two columns: the list on the left; this month and the
          money on the right. Phones read them one under the other. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="min-w-0 lg:max-w-2xl">
          {toOrderBlock}
          {toCollectBlock}
          {comingUpBlock}
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <div className="hidden lg:block">
            <HomeMonth entries={entries} today={today} />
          </div>
          {showMoney && moneyBlock}
        </div>
      </div>

      {/* Last, so appearing after hydration moves nothing above it. */}
      <InstallPrompt />
    </AppShell>
  );
}

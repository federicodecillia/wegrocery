import { adminAccess } from "@/lib/auth/access";
import { AppShell } from "@/components/app-shell";
import { BalanceDueCard } from "@/components/balance/balance-due-card";
import { HomeCalendar } from "@/components/home/home-calendar";
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
import { buildCalendar, dayOf, upcomingEvents } from "@/lib/calendar";
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
import { memberProductEmoji } from "@/lib/utils";
import { canAccessCycle } from "@/lib/roles";

/** Dates in Home's calendar section; the rest is one tap away in /calendario. */
const UPCOMING_ON_HOME = 3;

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

  const upcoming = upcomingEvents(buildCalendar(calendarRows, now), now, UPCOMING_ON_HOME);

  // 1. Calendar: what is coming, across the cycles (the pickups included).
  const calendarBlock = <HomeCalendar upcoming={upcoming} today={dayOf(now)} />;

  // 2. Open cycles: one compact card each; the member's order folds away.
  const cyclesBlock = (
    <HomeSection title={t.home.sectionOpen}>
      {cycleDataList.length === 0 ? (
        <div className="rounded-card border border-border bg-card px-4 py-3.5 shadow-card">
          <p className="text-[14px] font-semibold text-foreground">{t.home.noOpenOrders}</p>
          <p className="text-label text-secondary-foreground">{t.home.noOpenOrdersHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycleDataList.map(({ cycle, cycleProducts, myLines, orderTotal, payStatus }) => {
            const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));
            return (
              <OpenCycleCard
                key={cycle.cycleId}
                cycle={{
                  cycleId: cycle.cycleId,
                  title: cycle.title,
                  notes: cycle.notes,
                  orderOpenAt: new Date(cycle.orderOpenAt ?? cycle.createdAt).toISOString(),
                  orderCloseAt: new Date(cycle.orderCloseAt ?? new Date()).toISOString(),
                  pickupDate: cycle.pickupDate ? new Date(cycle.pickupDate).toISOString() : null,
                  pickupEndTime: cycle.pickupEndTime ?? null,
                  pickup2Date: cycle.pickup2Date ? new Date(cycle.pickup2Date).toISOString() : null,
                  pickup2EndTime: cycle.pickup2EndTime ?? null,
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

  // 3. Money: a compact balance line (card payments keep it near zero), then the movements.
  const moneyBlock = (
    <HomeSection title={t.home.sectionMoney} action={recentMovements.length > 0 ? { href: "/storico?tab=movimenti", label: t.home.seeAll } : undefined}>
      {!payPerOrder && (
        <HomeBalance
          balance={balance}
          afterOrders={globalOrderTotal > 0 ? afterBalance : null}
          feeIncluded={cycleDataList.some((d) => d.feeCents > 0)}
          topups={topups}
          cardSettlesWallet={settings.cardSettlesWallet}
          supportEmail={brand.supportEmail}
        />
      )}
      {recentMovements.map((e) => (
        <MovementRow key={e.entryId} entry={e} href="/storico?tab=movimenti" />
      ))}
    </HomeSection>
  );
  const showMoney = !payPerOrder || recentMovements.length > 0;

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

      {/* Sections: the calendar, the open cycles, then the money. From lg two
          columns: calendar and cycles on the left, money on the right. Phones
          read them in that order, one under the other. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {calendarBlock}
          {cyclesBlock}
        </div>
        {showMoney && <div className="min-w-0 lg:sticky lg:top-4">{moneyBlock}</div>}
      </div>

      {/* Last, so appearing after hydration moves nothing above it. */}
      <InstallPrompt />
    </AppShell>
  );
}

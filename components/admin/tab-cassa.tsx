import { getAllMembersLedger, getAllMembersWithBalances, getRequestedRefundCount } from "@/lib/db/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { isAboveMaxBalance } from "@/lib/payments/settings";
import { CassaInlineList, CassaSummaryCards, type BalanceFilter } from "./cassa-forms";
import { OutgoingMovementForm, TopupForm } from "./cassa-movement-form";
import { PendingRefundsNotice } from "./pending-refunds-notice";

type Props = {
  balanceFilter?: BalanceFilter;
  memberId?: string;
};

export async function TabCassa({ balanceFilter, memberId }: Props) {
  const [allBalances, ledgerByMember, { maxBalance }, requestedRefunds] = await Promise.all([
    getAllMembersWithBalances(),
    getAllMembersLedger(),
    getPaymentSettings(),
    getRequestedRefundCount(),
  ]);

  // A person who joined a family has no money of their own (it lives on the
  // family's account, named here with its people so a transfer from either
  // is easy to place). Shown apart only if something was booked to them.
  const familyNames = new Map<string, string[]>();
  for (const m of allBalances) {
    if (m.householdOf) familyNames.set(m.householdOf, [...(familyNames.get(m.householdOf) ?? []), m.fullName]);
  }
  const membersWithBalances = allBalances
    .filter((m) => !m.householdOf || Math.abs(m.balance) >= 0.005)
    .map((m) => {
      const others = familyNames.get(m.memberId);
      return others ? { ...m, fullName: `${m.fullName} + ${others.join(", ")}` } : m;
    });

  // Disabled members stay pickable, flagged: a member who left may still pay
  // off a debt or get the balance back. Enabled ones come first; the query
  // already sorts by name.
  const pickable = membersWithBalances.filter((m) => !m.householdOf);
  const pickerMembers = [
    ...pickable.filter((m) => m.active),
    ...pickable.filter((m) => !m.active),
  ].map(({ memberId, fullName, email, active, balance }) => ({ memberId, fullName, email, active, balance }));

  // Aggregate only across active members so a dormant socio with €0 doesn't
  // skew the average. Negative-balance count uses the same population.
  const activeBalances = membersWithBalances.filter((m) => m.active);
  const totalBalance = activeBalances.reduce((s, m) => s + m.balance, 0);
  const avgBalance = activeBalances.length > 0 ? totalBalance / activeBalances.length : 0;
  const negativeCount = activeBalances.filter((m) => m.balance < 0).length;
  // Only with a maximum set: balances above it (a Cassa top-up, or a
  // maximum lowered later).
  const aboveMaxCount =
    maxBalance === null ? null : activeBalances.filter((m) => isAboveMaxBalance(m.balance, maxBalance)).length;
  // A bookmarked "above max" filter means nothing once the maximum is gone
  // (its card is hidden, so it could not be cleared): show everyone.
  const filter = balanceFilter === "above_max" && maxBalance === null ? null : (balanceFilter ?? null);

  return (
    <div className="space-y-4">
      <CassaSummaryCards
        totalBalance={totalBalance}
        avgBalance={avgBalance}
        negativeCount={negativeCount}
        aboveMaxCount={aboveMaxCount}
        activeFilter={filter}
      />

      {requestedRefunds > 0 && <PendingRefundsNotice count={requestedRefunds} />}

      {/* Desktop: movement forms on the left, balances and history on the right. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
          <TopupForm members={pickerMembers} />
          <OutgoingMovementForm members={pickerMembers} />
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-[13px] font-bold text-brand-near-black">
              {t.admin.treasury.balancesTitle(membersWithBalances.length)}
            </h3>
          </CardHeader>
          <CassaInlineList
            members={membersWithBalances}
            ledgerByMember={ledgerByMember}
            balanceFilter={filter}
            maxBalance={maxBalance}
            openMemberId={memberId}
          />
        </Card>
      </div>
    </div>
  );
}

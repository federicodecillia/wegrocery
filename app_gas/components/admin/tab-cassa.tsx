import { getAllMembers, getAllMembersLedger, getAllMembersWithBalances } from "@/lib/db/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { CassaInlineList, CassaSummaryCards, TopupForm } from "./cassa-forms";

type Props = {
  balanceFilter?: "negative";
};

export async function TabCassa({ balanceFilter }: Props) {
  const [allMembers, membersWithBalances, ledgerByMember] = await Promise.all([
    getAllMembers(),
    getAllMembersWithBalances(),
    getAllMembersLedger(),
  ]);

  const topupMembers = allMembers
    .filter((m) => m.active)
    .map((m) => ({ memberId: m.memberId, fullName: m.fullName }));

  // Aggregate only across active members so a dormant socio with €0 doesn't
  // skew the average. Negative-balance count uses the same population.
  const activeBalances = membersWithBalances.filter((m) => m.active);
  const totalBalance = activeBalances.reduce((s, m) => s + m.balance, 0);
  const avgBalance = activeBalances.length > 0 ? totalBalance / activeBalances.length : 0;
  const negativeCount = activeBalances.filter((m) => m.balance < 0).length;

  return (
    <div className="space-y-4">
      <CassaSummaryCards
        totalBalance={totalBalance}
        avgBalance={avgBalance}
        negativeCount={negativeCount}
        activeFilter={balanceFilter ?? null}
      />

      <TopupForm members={topupMembers} />

      <Card>
        <CardHeader>
          <h3 className="text-[13px] font-bold text-pm-near-black">
            Saldi soci ({membersWithBalances.length})
          </h3>
        </CardHeader>
        <CassaInlineList
          members={membersWithBalances}
          ledgerByMember={ledgerByMember}
          balanceFilter={balanceFilter ?? null}
        />
      </Card>
    </div>
  );
}

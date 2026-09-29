import { getAllMembersLedger, getAllMembersWithBalances } from "@/lib/db/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { CassaInlineList, CassaSummaryCards } from "./cassa-forms";
import { OutgoingMovementForm, TopupForm } from "./cassa-movement-form";

type Props = {
  balanceFilter?: "negative";
};

export async function TabCassa({ balanceFilter }: Props) {
  const [membersWithBalances, ledgerByMember] = await Promise.all([
    getAllMembersWithBalances(),
    getAllMembersLedger(),
  ]);

  // Disabled members stay pickable, flagged: a member who left may still pay
  // off a debt or get the balance back. Enabled ones come first; the query
  // already sorts by name.
  const pickerMembers = [
    ...membersWithBalances.filter((m) => m.active),
    ...membersWithBalances.filter((m) => !m.active),
  ].map(({ memberId, fullName, email, active, balance }) => ({ memberId, fullName, email, active, balance }));

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

      <TopupForm members={pickerMembers} />
      <OutgoingMovementForm members={pickerMembers} />

      <Card>
        <CardHeader>
          <h3 className="text-[13px] font-bold text-brand-near-black">
            {t.admin.treasury.balancesTitle(membersWithBalances.length)}
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

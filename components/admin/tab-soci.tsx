import { getAllMembers, getAllMembersWithBalances } from "@/lib/db/queries";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { SociForm, SociList } from "./soci-form";

export async function TabSoci() {
  const [members, balances, settings] = await Promise.all([
    getAllMembers(),
    getAllMembersWithBalances(),
    getPaymentSettings(),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.memberId, b.balance]));
  const nameOf = new Map(members.map((m) => [m.memberId, m.fullName]));
  // "Paga fuori app" only means something when orders are paid per order.
  const offlineOption = settings.mode === "per_order";

  return (
    <div className="space-y-4">
      <SociForm offlineOption={offlineOption} />
      <SociList
        offlineOption={offlineOption}
        members={members.map((m) => ({
          memberId: m.memberId,
          fullName: m.fullName,
          email: m.email,
          aliasEmail: m.aliasEmail ?? null,
          role: m.role,
          active: m.active,
          paysOffline: m.paysOffline,
          lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
          balance: balanceOf.get(m.memberId) ?? 0,
          mergedIntoName: m.mergedInto ? (nameOf.get(m.mergedInto) ?? m.mergedInto) : null,
        }))}
      />
    </div>
  );
}

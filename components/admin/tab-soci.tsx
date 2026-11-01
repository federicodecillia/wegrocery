import { getAllMembers, getAllMembersWithBalances, getDismissedDuplicatePairs } from "@/lib/db/queries";
import { findDuplicatePairs } from "@/lib/members/duplicates";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { SociForm, SociList } from "./soci-form";
import { MemberOrders } from "./member-orders";
import { CreateToggle } from "./create-toggle";
import { t } from "@/lib/i18n";

// readOnly: a "Referente ordini" sees who the members are (name, role, access,
// last sign-in), never their balances, orders or the editing.
export async function TabSoci({ memberId, readOnly = false }: { memberId?: string; readOnly?: boolean }) {
  if (memberId && !readOnly) return <MemberOrders memberId={memberId} />;
  const [members, balances, settings, dismissed] = await Promise.all([
    getAllMembers(),
    readOnly ? [] : getAllMembersWithBalances(),
    getPaymentSettings(),
    getDismissedDuplicatePairs(),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.memberId, b.balance]));
  const nameOf = new Map(members.map((m) => [m.memberId, m.fullName]));
  // An account people joined: their names, for its own family badge.
  const joinedBy = new Map<string, string[]>();
  for (const m of members) {
    if (m.householdOf) joinedBy.set(m.householdOf, [...(joinedBy.get(m.householdOf) ?? []), m.fullName]);
  }
  // "Paga fuori app" only means something when orders are paid per order.
  const offlineOption = settings.mode === "per_order";

  return (
    <div className="space-y-4">
      {readOnly ? (
        <p className="max-w-prose text-[13px] text-secondary-foreground">{t.admin.members.readOnlyHint}</p>
      ) : (
        <CreateToggle label={t.admin.members.addMember}>
          <SociForm offlineOption={offlineOption} />
        </CreateToggle>
      )}
      <SociList
        readOnly={readOnly}
        offlineOption={offlineOption}
        // A person who joined a family is not a duplicate of anyone.
        duplicates={
          readOnly
            ? []
            : findDuplicatePairs(
                members.filter((m) => !m.householdOf),
                dismissed,
              )
        }
        members={members.map((m) => ({
          memberId: m.memberId,
          fullName: m.fullName,
          email: m.email,
          aliasEmail: m.aliasEmail ?? null,
          role: m.role,
          ordersReferent: m.ordersReferent,
          active: m.active,
          paysOffline: m.paysOffline,
          lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
          balance: readOnly ? 0 : (balanceOf.get(m.memberId) ?? 0),
          mergedIntoName: m.mergedInto ? (nameOf.get(m.mergedInto) ?? m.mergedInto) : null,
          householdOfName: m.householdOf ? (nameOf.get(m.householdOf) ?? m.householdOf) : null,
          familyNames: joinedBy.get(m.memberId)?.join(", ") ?? null,
        }))}
      />
    </div>
  );
}

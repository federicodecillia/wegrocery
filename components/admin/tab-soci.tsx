import { getAllMembers } from "@/lib/db/queries";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { SociForm, SociList } from "./soci-form";

export async function TabSoci() {
  const [members, settings] = await Promise.all([getAllMembers(), getPaymentSettings()]);
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
        }))}
      />
    </div>
  );
}

import { AdminWelcomeCard } from "@/components/admin/admin-welcome-card";
import { getGroupIdentity } from "@/lib/brand/get-brand";
import { adminWelcomeDone, adminWelcomeSteps } from "@/lib/admin/welcome";
import { getAdminWelcomeFacts, getMemberById } from "@/lib/db/queries";
import { getPaymentSettings } from "@/lib/payments/get-settings";

// The welcome card at the top of Admin, for each admin until they close it.
// Waits for the first-run setup (SetupBanner comes first on a new group);
// `reopened` (?benvenuto=1 from the admin guide) shows it again anyway.
export async function AdminWelcome({ personId, reopened }: { personId: string; reopened: boolean }) {
  if (!reopened) {
    const [identity, person] = await Promise.all([getGroupIdentity(), getMemberById(personId)]);
    if (!identity.setupCompletedAt || !person || person.adminWelcomeDismissedAt) return null;
  }
  const [settings, facts] = await Promise.all([getPaymentSettings(), getAdminWelcomeFacts()]);
  return (
    <AdminWelcomeCard
      steps={adminWelcomeSteps(settings.mode === "wallet")}
      done={adminWelcomeDone(facts)}
      reopened={reopened}
    />
  );
}

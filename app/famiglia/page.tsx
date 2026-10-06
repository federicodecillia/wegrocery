import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FamilyPanel } from "@/components/family-panel";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getFamilyPeople, getMemberBalance, getPendingFamilyInvites } from "@/lib/db/queries";
import { t } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";

// Families (lib/actions/family.ts): who shares this account, invitations
// sent and received, leave or remove.
export default async function FamilyPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;
  const personId = session.user.personId ?? memberId;
  const inFamily = personId !== memberId;

  const [settings, people, sent, received] = await Promise.all([
    getPaymentSettings(),
    getFamilyPeople(memberId),
    getPendingFamilyInvites({ fromAccountId: memberId }),
    inFamily ? Promise.resolve([]) : getPendingFamilyInvites({ toMemberId: personId }),
  ]);
  // What moves to the family on accepting: the person's own balance.
  const balance = received.length > 0 ? await getMemberBalance(personId) : 0;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={personId}>
      <div className="mb-4">
        <Link
          href="/notifiche/impostazioni"
          className="font-mono text-label font-bold uppercase tracking-widest text-brand-gray"
        >
          ← {t.notifications.settings.title}
        </Link>
      </div>
      <h1 className="mb-1 text-[20px] font-black tracking-[-0.03em] text-brand-near-black">{t.family.title}</h1>
      <p className="mb-5 text-[14px] leading-snug text-brand-gray">{t.family.intro}</p>

      <FamilyPanel
        enabled={settings.familiesEnabled}
        personId={personId}
        isOwner={!inFamily}
        people={people.map((p) => ({ memberId: p.memberId, fullName: p.fullName, email: p.email }))}
        sent={sent.map((i) => ({ inviteId: i.inviteId, name: i.memberName, email: i.memberEmail }))}
        received={received.map((i) => ({
          inviteId: i.inviteId,
          accountName: i.accountName,
          expires: formatDate(i.expiresAt),
        }))}
        balance={Math.abs(balance) < 0.005 ? null : formatMoney(balance)}
      />
    </AppShell>
  );
}

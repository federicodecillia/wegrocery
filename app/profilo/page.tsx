import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";
import { InstallRow } from "@/components/profile/install-row";
import { NameEditor } from "@/components/profile/name-editor";
import { SettingsRow, SettingsSection } from "@/components/profile/settings-row";
import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import {
  getFamilyPeople,
  getMemberBalance,
  getMemberById,
  getNotificationPreferences,
  getPendingFamilyInvites,
} from "@/lib/db/queries";
import { t } from "@/lib/i18n";
import { formatDate, formatSignedMoney } from "@/lib/i18n/format";
import { isMembershipCheckEnabled } from "@/lib/membership/wallyfor";
import { resolvePreferences } from "@/lib/notifications/categories";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { countChannels, familyState, initials } from "@/lib/profile/summary";
import { getRoleLabel } from "@/lib/roles";
import packageJson from "@/package.json";

// The member's own settings in one place, behind the header avatar: account,
// family, notifications, money, the app, sign-out. Each row says its current
// state; rows for what this deploy has not switched on are left out.
export default async function ProfilePage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;
  const personId = session.user.personId ?? memberId;
  const inFamily = personId !== memberId;

  const [person, account, settings, prefRows, people, received] = await Promise.all([
    getMemberById(personId),
    inFamily ? getMemberById(memberId) : Promise.resolve(null),
    getPaymentSettings(),
    getNotificationPreferences(memberId),
    getFamilyPeople(memberId),
    inFamily ? Promise.resolve([]) : getPendingFamilyInvites({ toMemberId: personId }),
  ]);

  // The wallet view (balance, top-up) unless the group pays per order and
  // this member pays in the app; the same rule as Home and /ricarica.
  const wallet = settings.mode !== "per_order" || Boolean(account?.paysOffline ?? person?.paysOffline);
  const paysOffline = settings.mode === "per_order" && Boolean(account?.paysOffline ?? person?.paysOffline);
  const balance = wallet ? await getMemberBalance(memberId) : 0;

  const name = person?.fullName ?? session.user.fullName ?? "";
  const channels = countChannels(resolvePreferences(prefRows));
  const family = familyState({ personId, people, invitesReceived: received.length });
  const showFamily = settings.familiesEnabled || people.length > 1 || received.length > 0;
  const showCard = isMembershipCheckEnabled() && role !== "admin" && person != null;
  const addresses = [person?.email, person?.aliasEmail].filter((a): a is string => Boolean(a));

  const topupDetail =
    settings.onlineTopupAvailable && settings.bankTransfer
      ? t.profile.topupBoth
      : settings.onlineTopupAvailable
        ? t.profile.topupOnline
        : settings.bankTransfer
          ? t.profile.topupBank
          : null;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={personId}>
      <div className="mb-5 flex items-center gap-4">
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-[20px] font-black tracking-tight text-on-primary"
        >
          {initials(name, session.user.email)}
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-[20px] font-black tracking-[-0.03em] text-brand-near-black">{name || t.profile.title}</h1>
          <p className="break-all text-[14px] text-brand-gray">{session.user.email}</p>
          <p className="mt-[2px] text-[12px] text-brand-gray">
            {role ? getRoleLabel(role) : null}
            {inFamily && account ? ` · ${t.profile.sharedAccount(account.fullName)}` : null}
          </p>
        </div>
      </div>

      <SettingsSection title={t.profile.account}>
        <NameEditor name={name} />
        <SettingsRow
          title={t.profile.emails}
          detail={
            <>
              {addresses.map((a) => (
                <span key={a} className="block break-all">
                  {a}
                </span>
              ))}
              <span className="mt-1 block">{t.profile.emailsHint(brand.supportEmail)}</span>
            </>
          }
        />
        {showCard && (
          <SettingsRow
            title={t.profile.card}
            detail={
              person.membershipStatus === "valid"
                ? person.membershipVerifiedAt
                  ? t.profile.cardValid(formatDate(person.membershipVerifiedAt))
                  : t.profile.cardValidNoDate
                : person.membershipStatus === "invalid"
                  ? t.profile.cardInvalid
                  : t.profile.cardUnknown
            }
          />
        )}
      </SettingsSection>

      {showFamily && (
        <SettingsSection title={t.profile.family}>
          <SettingsRow
            href="/famiglia"
            title={t.family.title}
            badge={family.kind === "invited"}
            detail={
              family.kind === "invited"
                ? t.profile.familyInvited(family.count)
                : family.kind === "with"
                  ? t.profile.familyWith(family.names.join(", "))
                  : t.profile.familyAlone
            }
          />
        </SettingsSection>
      )}

      <SettingsSection title={t.profile.notifications}>
        <SettingsRow
          href="/profilo/notifiche"
          title={t.notifications.settings.title}
          detail={t.profile.notificationsSummary(channels.app, channels.email, channels.total)}
        />
      </SettingsSection>

      <SettingsSection title={t.profile.money}>
        {wallet ? (
          <>
            <SettingsRow href="/storico" title={t.profile.balance} detail={t.profile.balanceDetail(formatSignedMoney(balance))} />
            {topupDetail && <SettingsRow href="/ricarica" title={t.topup.title} detail={topupDetail} />}
          </>
        ) : (
          <SettingsRow href="/ricarica" title={t.balance.title} detail={t.profile.perOrderDetail} />
        )}
        {paysOffline && <SettingsRow title={t.profile.paysOfflineTitle} detail={t.profile.paysOffline} />}
      </SettingsSection>

      <SettingsSection title={t.profile.app}>
        <InstallRow />
        <SettingsRow href="/guida" title={t.nav.guide} detail={t.profile.guideDetail} />
        <SettingsRow href="/changelog" title={t.profile.news} detail={t.profile.newsDetail} />
        {brand.privacyUrl && <SettingsRow href={brand.privacyUrl} title={t.profile.privacy} />}
        <SettingsRow href={`mailto:${brand.supportEmail}`} title={t.profile.contact} detail={brand.supportEmail} />
      </SettingsSection>

      <LogoutButton
        action={async () => {
          "use server";
          await signOut();
          redirect("/login");
        }}
      />
      <p className="mt-3 text-center text-label text-muted">{t.profile.version(packageJson.version)}</p>
    </AppShell>
  );
}

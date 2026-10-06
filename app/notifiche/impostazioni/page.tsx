import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/db/queries";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { resolvePreferences } from "@/lib/notifications/categories";

export default async function NotificationSettingsPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [rows, settings] = await Promise.all([getNotificationPreferences(memberId), getPaymentSettings()]);
  const initial = resolvePreferences(rows);
  // Families (app/famiglia): offered when switched on, or to someone already in one.
  const inFamily = session.user.personId != null && session.user.personId !== memberId;
  const showFamily = settings.familiesEnabled || inFamily;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
      <div className="mb-4">
        <Link
          href="/notifiche"
          className="font-mono text-label font-bold uppercase tracking-widest text-brand-gray"
        >
          ← {t.notifications.settings.back}
        </Link>
      </div>
      <h1 className="mb-1 text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
        {t.notifications.settings.title}
      </h1>
      <p className="mb-5 text-[14px] leading-snug text-brand-gray">
        {t.notifications.settings.intro}
      </p>

      <NotificationPreferencesForm initial={initial} />

      {showFamily && (
        <Link
          href="/famiglia"
          className="mt-[14px] block rounded-[18px] border border-brand-border bg-white px-4 py-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <div className="text-[14px] font-bold text-brand-near-black">{t.family.settingsLink} →</div>
          <div className="mt-[3px] text-[12px] leading-snug text-brand-gray">{t.family.settingsLinkHint}</div>
        </Link>
      )}
    </AppShell>
  );
}

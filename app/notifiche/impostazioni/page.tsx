import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/db/queries";
import { resolvePreferences } from "@/lib/notifications/categories";

export default async function NotificationSettingsPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const rows = await getNotificationPreferences(memberId);
  const initial = resolvePreferences(rows);

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      <div className="mb-4">
        <Link
          href="/notifiche"
          className="font-mono text-[11px] font-bold uppercase tracking-widest text-brand-gray"
        >
          ← {t.notifications.settings.back}
        </Link>
      </div>
      <h1 className="mb-1 text-[20px] font-black tracking-[-0.03em] text-brand-near-black">
        {t.notifications.settings.title}
      </h1>
      <p className="mb-5 text-[13px] leading-snug text-brand-gray">
        {t.notifications.settings.intro}
      </p>

      <NotificationPreferencesForm initial={initial} />
    </AppShell>
  );
}

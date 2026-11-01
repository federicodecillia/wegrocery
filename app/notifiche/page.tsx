import { Settings } from "lucide-react";
import { adminAccess } from "@/lib/auth/access";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { t } from "@/lib/i18n";
import { requireUserSession } from "@/lib/auth/session";
import { getMemberNotifications, notificationOwners } from "@/lib/db/queries";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { formatTime } from "@/lib/i18n/format";
import { groupByDay } from "@/lib/notifications/day-groups";
import { NotificationRow } from "./notification-row";
import { HelpLink } from "@/components/guide/help-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.notifications.title };

export default async function NotifichePage() {
  const session = await requireUserSession();
  const memberId = session.user.memberId!;

  const notifications = await getMemberNotifications(notificationOwners(memberId, session.user.personId), 50);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} admin={adminAccess(session.user)} memberId={memberId} personId={session.user.personId}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-title font-black text-foreground">
            {t.notifications.title}
          </h1>
          <HelpLink href="/guida/notifiche" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <form
              action={async () => {
                "use server";
                await markAllNotificationsRead();
              }}
            >
              <button
                type="submit"
                className="min-h-11 whitespace-nowrap rounded-full border border-border px-3.25 py-1.25 font-mono text-label font-bold uppercase tracking-widest text-foreground"
              >
                {t.notifications.markAllRead}
              </button>
            </form>
          )}
          <Link
            href="/profilo/notifiche"
            aria-label={t.notifications.settings.link}
            title={t.notifications.settings.link}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-secondary-foreground"
          >
            <Settings aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">🔔</span>
          <p className="text-[15px] font-bold text-foreground">{t.notifications.noNotifications}</p>
          <p className="mt-1 text-[14px] text-secondary-foreground">
            {t.notifications.noNotificationsHint}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupByDay(notifications, new Date()).map((g) => (
            <section key={g.key} aria-labelledby={`day-${g.key}`}>
              <h2 id={`day-${g.key}`} className="mb-2 px-1 text-[13px] font-semibold text-secondary-foreground first-letter:uppercase">
                {g.label}
              </h2>
              <ul className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                {g.items.map((n) => (
                  <li key={n.notificationId} className="border-b border-border last:border-none">
                    <NotificationRow
                      id={n.notificationId}
                      href={n.href ?? "/storico"}
                      title={n.title}
                      body={n.body}
                      time={formatTime(n.createdAt)}
                      unread={!n.readAt}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

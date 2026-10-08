import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { t } from "@/lib/i18n";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getMemberNotifications, notificationOwners } from "@/lib/db/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDateShort } from "@/lib/utils";
import { HelpLink } from "@/components/guide/help-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.notifications.title };

export default async function NotifichePage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const notifications = await getMemberNotifications(notificationOwners(memberId, session.user.personId), 50);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-title font-black text-brand-near-black">
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
                className="min-h-8 whitespace-nowrap rounded-full border border-brand-border px-[13px] py-[5px] font-mono text-label font-bold uppercase tracking-widest text-brand-near-black"
              >
                {t.notifications.markAllRead}
              </button>
            </form>
          )}
          <Link
            href="/profilo/notifiche"
            aria-label={t.notifications.settings.link}
            title={t.notifications.settings.link}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border text-brand-gray"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-4xl">🔔</span>
          <p className="text-[15px] font-bold text-brand-near-black">{t.notifications.noNotifications}</p>
          <p className="mt-1 text-[14px] text-brand-gray">
            {t.notifications.noNotificationsHint}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-border bg-white shadow-card">
          {notifications.map((n, i) => (
            <form
              key={n.notificationId}
              action={async () => {
                "use server";
                await markNotificationRead(n.notificationId);
                redirect(n.href ?? "/storico");
              }}
              className={i < notifications.length - 1 ? "border-b border-brand-border" : ""}
            >
              <button
                type="submit"
                className="flex w-full items-start gap-3 px-4 py-[14px] text-left"
              >
                <span
                  className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${
                    n.readAt ? "bg-transparent" : "bg-primary"
                  }`}
                  aria-label={n.readAt ? undefined : t.notifications.unreadLabel}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[14px] leading-snug ${
                      n.readAt ? "font-medium text-brand-gray" : "font-bold text-brand-near-black"
                    }`}
                  >
                    {n.title}
                  </div>
                  <div className="mt-[3px] text-[14px] leading-snug text-brand-gray">{n.body}</div>
                  <div className="mt-[5px] font-mono text-label text-muted">
                    {formatDateShort(n.createdAt)}
                  </div>
                </div>
              </button>
            </form>
          ))}
        </div>
      )}
    </AppShell>
  );
}

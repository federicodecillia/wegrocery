"use client";

import Link from "next/link";
import { markNotificationRead } from "@/lib/actions/notifications";
import { t } from "@/lib/i18n";

// One notification, a plain link: the page opens at once and the row is
// marked read on the way (the action's revalidation updates the bell).
export function NotificationRow({
  id,
  href,
  title,
  body,
  time,
  unread,
}: {
  id: string;
  href: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (unread) void markNotificationRead(id).catch(() => {});
      }}
      className="flex w-full items-start gap-3 px-4 py-[14px] text-left hover:bg-black/[0.02]"
    >
      <span aria-hidden className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-[14px] leading-snug ${unread ? "font-bold text-brand-near-black" : "font-medium text-brand-gray"}`}>
            {title}
          </span>
          {unread && (
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-[1px] text-label font-bold text-primary-text">
              {t.notifications.newBadge}
            </span>
          )}
        </span>
        <span className="mt-[3px] block text-[14px] leading-snug text-brand-gray">{body}</span>
        <span className="mt-[5px] block text-label tabular-nums text-muted">{time}</span>
      </span>
    </Link>
  );
}

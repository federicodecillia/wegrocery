"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNotificationsPath } from "@/components/nav-items";
import { t } from "@/lib/i18n";

type NotificationBellProps = {
  unreadCount: number;
};

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const current = isNotificationsPath(usePathname());
  return (
    <Link
      href="/notifiche"
      aria-current={current ? "page" : undefined}
      className={`hit-44 flex size-(--control-h) items-center justify-center rounded-full transition-colors ${
        current ? "bg-primary-bg text-primary-text" : "text-secondary-foreground hover:text-foreground"
      }`}
      aria-label={unreadCount > 0 ? t.notifications.unreadCountLabel(unreadCount) : t.notifications.title}
    >
      <Bell aria-hidden className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-0.75 tabular-nums text-label font-bold leading-none text-danger-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

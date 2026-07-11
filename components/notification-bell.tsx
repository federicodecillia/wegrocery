import Link from "next/link";
import { t } from "@/lib/i18n";

type NotificationBellProps = {
  unreadCount: number;
};

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  return (
    <Link
      href="/notifiche"
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-brand-gray transition-colors hover:text-brand-near-black"
      aria-label={unreadCount > 0 ? t.notifications.unreadCountLabel(unreadCount) : t.notifications.title}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-[3px] font-mono text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

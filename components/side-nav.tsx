"use client";

import { Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, isNotificationsPath, isProfilePath, visibleNavItems } from "@/components/nav-items";
import { ADMIN_GUIDE_HREF, adminHref, adminSectionsFor, resolveAdminRoute } from "@/lib/admin/nav";
import { t } from "@/lib/i18n";
import { initials } from "@/lib/profile/summary";

type SideNavProps = {
  admin: "admin" | "referent" | null;
  unreadCount: number;
  name?: string | null;
  email: string;
  appName: string;
  logoUrl: string;
  showName: boolean;
};

// Tablet and PC navigation, replacing BottomNav and the header from md:
// a rail (icon over label) on a tablet, a sidebar (icon beside label) from
// lg. The items are the same as the bottom bar's (nav-items.ts); from lg the
// admin's sections hang under Admin, so the admin page drops its pill bar.
export function SideNav({ admin, unreadCount, name, email, appName, logoUrl, showName }: SideNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const { section } = resolveAdminRoute(
    searchParams.get("tab") ?? undefined,
    searchParams.get("view") ?? undefined,
    searchParams.get("member") ?? undefined,
    searchParams.get("cycle") ?? undefined,
  );
  const bellCurrent = isNotificationsPath(pathname);
  const profileCurrent = isProfilePath(pathname);

  const itemClass = (active: boolean) =>
    `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-label font-medium lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[14px] ${
      active ? "bg-primary-bg text-primary-text" : "text-secondary-foreground hover:bg-tint/[0.04] hover:text-foreground"
    }`;

  return (
    <aside className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col border-r border-border bg-background md:flex lg:w-[248px]">
      <Link href="/" aria-label={t.nav.home} className="flex min-h-16 items-center justify-center gap-2 px-3 lg:justify-start lg:px-5">
        <Image src={logoUrl} alt={appName} width={28} height={28} className="h-7 w-auto shrink-0" />
        {showName && <span className="hidden truncate text-[15px] font-semibold text-foreground lg:inline">{appName}</span>}
      </Link>

      <nav aria-label={t.nav.mainAria} className="flex-1 overflow-y-auto px-2 py-2 lg:px-3">
        <ul className="space-y-1">
          {visibleNavItems(admin !== null).map((item) => {
            const active = isItemActive(pathname, item);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active && !(item.href === "/admin" && onAdmin) ? "page" : undefined} className={itemClass(active)}>
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
                {item.href === "/admin" && onAdmin && (
                  <ul className="mt-1 hidden space-y-0.5 border-l border-border pl-3 lg:ml-5 lg:block">
                    {(admin ? [...adminSectionsFor(admin).primary, ...adminSectionsFor(admin).more] : []).map((s) => (
                      <li key={s.id}>
                        <Link
                          href={adminHref(s.id)}
                          aria-current={section === s.id ? "page" : undefined}
                          className={`flex min-h-(--control-h) items-center rounded-xl px-3 text-[14px] ${
                            section === s.id ? "font-semibold text-foreground bg-tint/[0.05]" : "text-secondary-foreground hover:text-foreground"
                          }`}
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        href={ADMIN_GUIDE_HREF}
                        className="flex min-h-(--control-h) items-center rounded-xl px-3 text-[14px] text-secondary-foreground hover:text-foreground"
                      >
                        {t.admin.nav.guide}
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-border px-2 py-3 lg:px-3">
        <Link
          href="/notifiche"
          aria-current={bellCurrent ? "page" : undefined}
          aria-label={unreadCount > 0 ? t.notifications.unreadCountLabel(unreadCount) : t.notifications.title}
          className={`relative ${itemClass(bellCurrent)}`}
        >
          <span className="relative">
            <Bell aria-hidden className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-0.75 tabular-nums text-label font-bold leading-none text-danger-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          <span>{t.notifications.title}</span>
        </Link>
        <Link href="/profilo" aria-current={profileCurrent ? "page" : undefined} className={itemClass(profileCurrent)}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-black tracking-tight text-primary-foreground">
            {initials(name, email)}
          </span>
          <span className="max-w-full truncate">{t.profile.title}</span>
        </Link>
      </div>
    </aside>
  );
}

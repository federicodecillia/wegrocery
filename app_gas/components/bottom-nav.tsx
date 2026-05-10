"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavProps = {
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  adminOnly?: boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M6.75 9.5V21h10.5V9.5" />
      </svg>
    ),
  },
  {
    href: "/ordine",
    label: "Ordine",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M3 4h2l2.5 11h11l2-8H6.5" />
      </svg>
    ),
  },
  {
    href: "/storico",
    label: "Storico",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v4h4" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/guida",
    label: "Guida",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 17h.01" />
        <path d="M10.3 9.2a2 2 0 1 1 3.7 1c-.4.6-1 .9-1.4 1.4-.2.2-.3.5-.3 1" />
      </svg>
    ),
  },
  {
    href: "/admin",
    label: "Admin",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.5-4.8-2.5-4.8 2.5.9-5.5L4.2 8.7l5.4-.8z" />
      </svg>
    ),
  },
];

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-pm-border bg-pm-warm-white pb-[env(safe-area-inset-bottom)]">
      <ul className="grid h-nav-h grid-cols-5">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item);
          const locked = item.adminOnly && !isAdmin;
          const baseClasses =
            "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-[0.02em]";
          const stateClasses = active
            ? "text-pm-orange"
            : locked
              ? "text-pm-gray-light"
              : "text-pm-gray";

          return (
            <li key={item.href}>
              {locked ? (
                <span aria-disabled className={`${baseClasses} ${stateClasses}`}>
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              ) : (
                <Link href={item.href} className={`${baseClasses} ${stateClasses}`}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, navItems } from "@/components/nav-items";

type BottomNavProps = {
  isAdmin: boolean;
};

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-brand-border bg-brand-warm-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid h-nav-h grid-cols-5">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item);
          const locked = item.adminOnly && !isAdmin;
          const baseClasses =
            "flex h-full flex-col items-center justify-center gap-1 text-label font-medium tracking-[0.02em]";
          const stateClasses = active
            ? "text-primary-text"
            : locked
              ? "text-muted"
              : "text-brand-gray";

          return (
            <li key={item.href}>
              {locked ? (
                <span aria-disabled className={`${baseClasses} ${stateClasses}`}>
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${baseClasses} ${stateClasses}`}
                >
                  <NavIcon name={item.icon} />
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

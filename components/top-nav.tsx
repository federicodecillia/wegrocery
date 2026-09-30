"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, navItems } from "@/components/nav-items";

type TopNavProps = {
  isAdmin: boolean;
};

// Desktop navigation (from lg): replaces BottomNav, which is hidden there.
export function TopNav({ isAdmin }: TopNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mt-3 hidden lg:block">
      <ul className="flex gap-1">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item);
          const locked = item.adminOnly && !isAdmin;
          const baseClasses = "flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium";
          const stateClasses = active
            ? "bg-primary-soft text-primary-text"
            : locked
              ? "text-muted"
              : "text-brand-gray hover:text-brand-near-black";

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

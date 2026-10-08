"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, visibleNavItems } from "@/components/nav-items";

type TopNavProps = {
  isAdmin: boolean;
};

// Desktop navigation (from lg): replaces BottomNav, which is hidden there.
export function TopNav({ isAdmin }: TopNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mt-3 hidden lg:block">
      <ul className="flex gap-1">
        {visibleNavItems(isAdmin).map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium ${
                  active ? "bg-primary-soft text-primary-text" : "text-brand-gray hover:text-brand-near-black"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
          })}
      </ul>
    </nav>
  );
}

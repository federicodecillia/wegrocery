"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { refreshAllowed } from "@/lib/ui/refresh";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, visibleNavItems } from "@/components/nav-items";

type TopNavProps = {
  isAdmin: boolean;
};

// Desktop navigation (from lg), in the header row between the logo and the
// bell: replaces BottomNav, which is hidden there.
export function TopNav({ isAdmin }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="hidden min-w-0 flex-1 lg:block">
      <ul className="flex gap-1">
        {visibleNavItems(isAdmin).map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                // The current item again: back to the top with fresh data
                // (the iOS habit), except on the order page.
                onClick={(e) => {
                  if (!active || pathname !== item.href || !refreshAllowed(pathname)) return;
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                  router.refresh();
                }}
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

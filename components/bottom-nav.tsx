"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { refreshAllowed } from "@/lib/ui/refresh";
import { NavIcon } from "@/components/nav-icon";
import { isItemActive, visibleNavItems } from "@/components/nav-items";

type BottomNavProps = {
  isAdmin: boolean;
};

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Members get four items; a locked "Admin" only took their space.
  const items = visibleNavItems(isAdmin);

  return (
    <nav className="sticky bottom-0 z-20 border-t border-brand-border bg-brand-warm-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className={`grid h-nav-h ${items.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
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
                className={`flex h-full flex-col items-center justify-center gap-1 text-label font-medium tracking-[0.02em] ${
                  active ? "text-primary-text" : "text-brand-gray"
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

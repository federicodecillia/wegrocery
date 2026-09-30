import { t } from "@/lib/i18n";

export type NavIconName = "home" | "order" | "history" | "guide" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
  adminOnly?: boolean;
};

// Shared by BottomNav (up to lg) and TopNav (from lg). Icons live in
// nav-icon.tsx so this file stays plain TypeScript.
export const navItems: NavItem[] = [
  { href: "/", label: t.nav.home, icon: "home", exact: true },
  { href: "/ordine", label: t.nav.order, icon: "order" },
  { href: "/storico", label: t.nav.history, icon: "history" },
  { href: "/guida", label: t.nav.guide, icon: "guide" },
  { href: "/admin", label: t.nav.admin, icon: "admin", adminOnly: true },
];

export function isItemActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

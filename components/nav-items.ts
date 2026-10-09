import { t } from "@/lib/i18n";

export type NavIconName = "home" | "order" | "history" | "guide" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
  adminOnly?: boolean;
  /** Pages with no item of their own that belong to this one (Ricarica is reached from the balance on Home). */
  also?: string[];
};

// Shared by BottomNav (up to lg) and TopNav (from lg). Icons live in
// nav-icon.tsx so this file stays plain TypeScript.
export const navItems: NavItem[] = [
  { href: "/", label: t.nav.home, icon: "home", exact: true, also: ["/ricarica"] },
  { href: "/ordine", label: t.nav.order, icon: "order" },
  { href: "/storico", label: t.nav.history, icon: "history" },
  { href: "/guida", label: t.nav.guide, icon: "guide" },
  { href: "/admin", label: t.nav.admin, icon: "admin", adminOnly: true },
];

function under(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isItemActive(pathname: string, item: Pick<NavItem, "href" | "exact" | "also">) {
  if (item.also?.some((href) => under(pathname, href))) return true;
  if (item.exact) return pathname === item.href;
  return under(pathname, item.href);
}

/** The header's bell and avatar mark their pages as current too (the Family page sits in the Profile). */
export const isNotificationsPath = (pathname: string) => under(pathname, "/notifiche");
export const isProfilePath = (pathname: string) => under(pathname, "/profilo") || under(pathname, "/famiglia");

/** The items a person sees: Admin only for admins (members get four). */
export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return navItems.filter((item) => isAdmin || !item.adminOnly);
}

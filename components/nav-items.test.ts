import { describe, it, expect } from "vitest";
import { isItemActive, isNotificationsPath, isProfilePath, navItems, visibleNavItems } from "./nav-items";

const item = (href: string) => navItems.find((i) => i.href === href)!;

describe("nav items", () => {
  it("Home is active only on the exact path", () => {
    expect(isItemActive("/", item("/"))).toBe(true);
    expect(isItemActive("/ordine", item("/"))).toBe(false);
  });

  it("a section is active on its own path and below it", () => {
    expect(isItemActive("/admin", item("/admin"))).toBe(true);
    expect(isItemActive("/admin/x", item("/admin"))).toBe(true);
    expect(isItemActive("/ordine", item("/ordine"))).toBe(true);
  });

  it("a path that only shares a prefix is not active", () => {
    expect(isItemActive("/ordine-vecchio", item("/ordine"))).toBe(false);
    expect(isItemActive("/storico", item("/ordine"))).toBe(false);
  });

  it("only Admin is reserved to admins", () => {
    expect(navItems.filter((i) => i.adminOnly).map((i) => i.href)).toEqual(["/admin"]);
  });

  it("members see four items, admins five", () => {
    expect(visibleNavItems(false).map((i) => i.href)).toEqual(["/", "/ordine", "/storico", "/guida"]);
    expect(visibleNavItems(true)).toHaveLength(5);
  });

  it("Ricarica keeps Home current", () => {
    expect(isItemActive("/ricarica", item("/"))).toBe(true);
    expect(isItemActive("/ricarica", item("/ordine"))).toBe(false);
  });

  it("the bell and the avatar mark their pages", () => {
    expect(isNotificationsPath("/notifiche")).toBe(true);
    expect(isNotificationsPath("/profilo/notifiche")).toBe(false);
    expect(isProfilePath("/profilo/notifiche")).toBe(true);
    expect(isProfilePath("/famiglia")).toBe(true);
    expect(isProfilePath("/profilone")).toBe(false);
  });
});

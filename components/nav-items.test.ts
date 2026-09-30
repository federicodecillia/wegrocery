import { describe, it, expect } from "vitest";
import { isItemActive, navItems } from "./nav-items";

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
});

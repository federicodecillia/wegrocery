import { describe, expect, it } from "vitest";
import { canAccessCycle } from "./utils";

describe("canAccessCycle", () => {
  it("always lets admins in, regardless of accessLevel", () => {
    expect(canAccessCycle("admin", "admin")).toBe(true);
    expect(canAccessCycle("soci", "admin")).toBe(true);
  });

  it("lets any signed-in role through for 'all'/'utenti' cycles", () => {
    expect(canAccessCycle("all", "socio")).toBe(true);
    expect(canAccessCycle("utenti", null)).toBe(true);
    expect(canAccessCycle("utenti", undefined)).toBe(true);
  });

  it("locks 'admin'-only cycles to admins", () => {
    expect(canAccessCycle("admin", "socio")).toBe(false);
    expect(canAccessCycle("admin", "attivo")).toBe(false);
  });

  it("lets member-tier roles through for 'soci'/'attivi'/'member' cycles", () => {
    expect(canAccessCycle("soci", "socio")).toBe(true);
    expect(canAccessCycle("attivi", "attivo")).toBe(true);
    expect(canAccessCycle("member", "member")).toBe(true);
    expect(canAccessCycle("soci", null)).toBe(false);
  });

  it("denies unrecognized accessLevel values", () => {
    expect(canAccessCycle("qualcosa_di_strano", "socio")).toBe(false);
  });
});

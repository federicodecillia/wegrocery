import { describe, it, expect } from "vitest";
import {
  selectCycleAccessMembers,
  type MemberForTargeting,
} from "./reminder";

const members: MemberForTargeting[] = [
  { memberId: "m_admin", email: "a@x.it", role: "admin", active: true },
  { memberId: "m_attivi", email: "b@x.it", role: "attivi", active: true },
  { memberId: "m_utenti", email: "c@x.it", role: "utenti", active: true },
  { memberId: "m_legacy_socio", email: "e@x.it", role: "socio", active: true },
  { memberId: "m_inactive", email: "d@x.it", role: "attivi", active: false },
];

const ids = (list: MemberForTargeting[]) => list.map((m) => m.memberId).sort();

describe("selectCycleAccessMembers", () => {
  it("excludes inactive members regardless of role", () => {
    const result = selectCycleAccessMembers(members, "utenti");
    expect(result.some((m) => m.memberId === "m_inactive")).toBe(false);
  });

  it("a 'utenti' cycle reaches every active member", () => {
    expect(ids(selectCycleAccessMembers(members, "utenti"))).toEqual([
      "m_admin",
      "m_attivi",
      "m_legacy_socio",
      "m_utenti",
    ]);
  });

  it("an 'attivi' cycle reaches attivi and admins, not utenti", () => {
    expect(ids(selectCycleAccessMembers(members, "attivi"))).toEqual(["m_admin", "m_attivi"]);
  });

  it("a legacy 'soci' cycle is treated as 'attivi'", () => {
    expect(ids(selectCycleAccessMembers(members, "soci"))).toEqual(["m_admin", "m_attivi"]);
  });

  it("an 'admin' cycle reaches only admins", () => {
    expect(ids(selectCycleAccessMembers(members, "admin"))).toEqual(["m_admin"]);
  });
});

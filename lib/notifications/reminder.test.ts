import { describe, it, expect } from "vitest";
import {
  selectCycleAccessMembers,
  selectReminderTargets,
  type MemberForTargeting,
} from "./reminder";

const members: MemberForTargeting[] = [
  { memberId: "m_admin", email: "a@x.it", role: "admin", active: true },
  { memberId: "m_attivo", email: "b@x.it", role: "attivo", active: true },
  { memberId: "m_socio", email: "c@x.it", role: "socio", active: true },
  { memberId: "m_inactive", email: "d@x.it", role: "attivo", active: false },
];

const ids = (list: MemberForTargeting[]) => list.map((m) => m.memberId).sort();

describe("selectCycleAccessMembers", () => {
  it("excludes inactive members regardless of role", () => {
    const result = selectCycleAccessMembers(members, "all");
    expect(result.some((m) => m.memberId === "m_inactive")).toBe(false);
  });

  it("accessLevel 'all' reaches every active member", () => {
    expect(ids(selectCycleAccessMembers(members, "all"))).toEqual(["m_admin", "m_attivo", "m_socio"]);
  });

  it("accessLevel 'attivi' reaches active socio/attivo + admin, not read-only... admin always passes", () => {
    // canAccessCycle: attivi ⇒ role attivo/member/socio; admin always true.
    expect(ids(selectCycleAccessMembers(members, "attivi"))).toEqual([
      "m_admin",
      "m_attivo",
      "m_socio",
    ]);
  });

  it("accessLevel 'admin' reaches only admins", () => {
    expect(ids(selectCycleAccessMembers(members, "admin"))).toEqual(["m_admin"]);
  });
});

describe("selectReminderTargets", () => {
  it("drops members who already ordered", () => {
    const ordered = new Set(["m_attivo"]);
    const result = selectReminderTargets(members, "all", ordered);
    expect(ids(result)).toEqual(["m_admin", "m_socio"]);
  });

  it("returns everyone with access when nobody has ordered", () => {
    const result = selectReminderTargets(members, "all", new Set());
    expect(ids(result)).toEqual(["m_admin", "m_attivo", "m_socio"]);
  });

  it("respects the access gate before the ordered filter", () => {
    const result = selectReminderTargets(members, "admin", new Set());
    expect(ids(result)).toEqual(["m_admin"]);
  });
});

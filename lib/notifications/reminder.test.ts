import { describe, it, expect } from "vitest";
import {
  REMINDER_WINDOW_MS,
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

describe("REMINDER_WINDOW_MS", () => {
  // The window is not a taste decision: a cycle closing in a gap between two
  // successful cron pings gets no reminder at all, so the window has to be
  // wider than the longest gap the scheduler actually produces. Measured over
  // 2026-07-30 to 2026-08-07, the longest ordinary gap was 3.9h. This test
  // fails if someone narrows the window back under that ceiling without
  // re-measuring or moving off GitHub cron.
  const LONGEST_OBSERVED_GAP_MS = 3.9 * 60 * 60 * 1000;

  it("stays wider than the longest observed gap between cron pings", () => {
    expect(REMINDER_WINDOW_MS).toBeGreaterThan(LONGEST_OBSERVED_GAP_MS);
  });
});

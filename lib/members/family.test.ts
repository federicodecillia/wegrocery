import { describe, expect, it } from "vitest";
import { checkInvite, checkUnlink, familyRole, MAX_FAMILY_SIZE, sessionAccount, type FamilyPerson } from "./family";

function person(over: Partial<FamilyPerson> = {}): FamilyPerson {
  return { memberId: "mem_b", fullName: "Bea", role: "utenti", active: true, householdOf: null, ...over };
}

describe("familyRole", () => {
  it("keeps the admin panel personal", () => {
    expect(familyRole("admin", "utenti")).toBe("admin");
    expect(familyRole("utenti", "admin")).toBe("attivi");
  });

  it("gives cycle access by the higher of the two roles", () => {
    expect(familyRole("utenti", "attivi")).toBe("attivi");
    expect(familyRole("attivi", "utenti")).toBe("attivi");
    expect(familyRole("utenti", "utenti")).toBe("utenti");
  });

  it("refuses an unknown person role", () => {
    expect(familyRole("boss", "admin")).toBeNull();
  });
});

describe("sessionAccount", () => {
  const account = person({ memberId: "mem_a", fullName: "Ada" });

  it("is the person's own account outside a family", () => {
    expect(sessionAccount(person(), null)?.memberId).toBe("mem_b");
  });

  it("is the joined account for a person in a family", () => {
    expect(sessionAccount(person({ householdOf: "mem_a" }), account)?.memberId).toBe("mem_a");
  });

  it("signs out when the person or the account is not active", () => {
    expect(sessionAccount(person({ active: false }), null)).toBeNull();
    expect(sessionAccount(person({ householdOf: "mem_a" }), { ...account, active: false })).toBeNull();
    expect(sessionAccount(person({ householdOf: "mem_a" }), null)).toBeNull();
  });
});

describe("checkInvite", () => {
  const base = {
    enabled: true,
    accountId: "mem_a",
    target: person(),
    targetHouseholdMembers: 0,
    accountSize: 1,
    pendingToTarget: false,
  };

  it("lets a free, active member be invited", () => {
    expect(checkInvite(base)).toBeNull();
  });

  it.each([
    [{ enabled: false }, "disabled"],
    [{ target: null }, "not_member"],
    [{ target: person({ mergedInto: "mem_x" }) }, "not_member"],
    [{ target: person({ memberId: "mem_a" }) }, "self"],
    [{ target: person({ householdOf: "mem_a" }) }, "already_here"],
    [{ target: person({ active: false }) }, "inactive"],
    [{ target: person({ householdOf: "mem_x" }) }, "already_in_family"],
    [{ targetHouseholdMembers: 1 }, "has_family"],
    [{ accountSize: MAX_FAMILY_SIZE }, "family_full"],
    [{ pendingToTarget: true }, "already_invited"],
  ] as const)("refuses %o with %s", (over, code) => {
    expect(checkInvite({ ...base, ...over })).toBe(code);
  });
});

describe("checkUnlink", () => {
  const joined = person({ householdOf: "mem_a" });

  it("lets the person leave and the account's person remove them", () => {
    expect(checkUnlink(joined, "mem_b")).toBeNull();
    expect(checkUnlink(joined, "mem_a")).toBeNull();
  });

  it("refuses anyone else, and a person in no family", () => {
    expect(checkUnlink(joined, "mem_c")).toBe("not_allowed");
    expect(checkUnlink(person(), "mem_b")).toBe("not_in_family");
  });
});

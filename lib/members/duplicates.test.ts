import { describe, expect, it } from "vitest";
import { findDuplicatePairs, nameTokens, pairKey, type DuplicateCandidate } from "./duplicates";

let seq = 0;
function member(over: Partial<DuplicateCandidate>): DuplicateCandidate {
  seq += 1;
  return {
    memberId: `mem_${seq}`,
    fullName: "Someone",
    email: `user${seq}@mail.example`,
    aliasEmail: null,
    role: "utenti",
    active: true,
    createdAt: new Date(2026, 0, seq),
    membershipStatus: null,
    mergedInto: null,
    ...over,
  };
}

describe("nameTokens", () => {
  it("ignores accents, case, spacing and word order", () => {
    expect(nameTokens("Marilù  Di Mauro")).toEqual(nameTokens("di mauro marilu"));
  });
});

describe("findDuplicatePairs", () => {
  it("pairs two accounts with the same name and keeps the higher role", () => {
    const old = member({ fullName: "Anna Bianchi", email: "anna@group.example", role: "attivi" });
    const fresh = member({ fullName: "anna bianchi", email: "ab@mail.example" });
    expect(findDuplicatePairs([fresh, old])).toEqual([
      { survivorId: old.memberId, absorbedId: fresh.memberId, reason: "same_name" },
    ]);
  });

  it("finds the name inside the other account's address", () => {
    const old = member({ fullName: "Luca Di Verdi", email: "luca@group.example", role: "attivi" });
    // Signed up with the email link: the name comes from the address.
    const fresh = member({ fullName: "luca.diverdi85", email: "luca.diverdi85@mail.example" });
    expect(findDuplicatePairs([old, fresh])).toEqual([
      { survivorId: old.memberId, absorbedId: fresh.memberId, reason: "name_in_address" },
    ]);
  });

  it("keeps the older account when the roles are equal", () => {
    const a = member({ fullName: "Paolo Neri" });
    const b = member({ fullName: "Paolo Neri" });
    expect(findDuplicatePairs([b, a])[0]).toMatchObject({ survivorId: a.memberId, absorbedId: b.memberId });
  });

  it("does not pair on a single word or on short particles", () => {
    expect(findDuplicatePairs([member({ fullName: "Mario" }), member({ fullName: "mario" })])).toEqual([]);
    const x = member({ fullName: "Ugo Di Lo" });
    const y = member({ fullName: "Other Person", email: "dilo@mail.example" });
    expect(findDuplicatePairs([x, y])).toEqual([]);
  });

  it("leaves out merged, deactivated and dismissed pairs", () => {
    const a = member({ fullName: "Sara Gialli" });
    const merged = member({ fullName: "Sara Gialli", mergedInto: a.memberId, active: false });
    const off = member({ fullName: "Sara Gialli", active: false });
    expect(findDuplicatePairs([a, merged, off])).toEqual([]);
    const b = member({ fullName: "Sara Gialli" });
    expect(findDuplicatePairs([a, b], new Set([pairKey(b.memberId, a.memberId).join(":")]))).toEqual([]);
  });

  it("lists first the pairs whose kept account failed the card check", () => {
    const p1 = member({ fullName: "Aldo Rossi" });
    const p2 = member({ fullName: "Aldo Rossi" });
    const q1 = member({ fullName: "Zeno Blu", membershipStatus: "invalid" });
    const q2 = member({ fullName: "Zeno Blu" });
    expect(findDuplicatePairs([p1, p2, q1, q2]).map((p) => p.survivorId)).toEqual([q1.memberId, p1.memberId]);
  });
});

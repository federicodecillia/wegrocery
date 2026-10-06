import { describe, expect, it } from "vitest";
import { cleanName, countChannels, familyState, initials, NAME_MAX_LENGTH } from "./summary";

describe("initials", () => {
  it("takes the first and last word of the name", () => {
    expect(initials("Mario Rossi", "m@x.it")).toBe("MR");
    expect(initials("anna maria de luca", "a@x.it")).toBe("AL");
  });

  it("keeps accented letters whole", () => {
    expect(initials("Éva Ölund", "e@x.it")).toBe("ÉÖ");
  });

  it("uses one letter for a single word", () => {
    expect(initials("Giulia", "g@x.it")).toBe("G");
  });

  it("falls back to the address when there is no name", () => {
    expect(initials("", "luca.bianchi@x.it")).toBe("L");
    expect(initials(null, "_9x@x.it")).toBe("9");
    expect(initials("  ", "@x.it")).toBe("?");
  });

  it("ignores words with no letters", () => {
    expect(initials("Mario & Anna", "m@x.it")).toBe("MA");
  });
});

describe("countChannels", () => {
  it("counts the groups each channel has on", () => {
    expect(
      countChannels({
        cycle_opened: { app: true, email: true },
        order_charge: { app: true, email: false },
        order_updates: { app: false, email: false },
        wallet_topup: { app: true, email: false },
      }),
    ).toEqual({ app: 3, email: 1, total: 4 });
  });
});

describe("familyState", () => {
  const people = [
    { memberId: "mem_a", fullName: "Mario Rossi" },
    { memberId: "mem_b", fullName: "Anna Rossi" },
  ];

  it("puts a pending invitation first", () => {
    expect(familyState({ personId: "mem_a", people, invitesReceived: 2 })).toEqual({ kind: "invited", count: 2 });
  });

  it("names the other people of the account", () => {
    expect(familyState({ personId: "mem_b", people, invitesReceived: 0 })).toEqual({ kind: "with", names: ["Mario Rossi"] });
  });

  it("is alone without others", () => {
    expect(familyState({ personId: "mem_a", people: people.slice(0, 1), invitesReceived: 0 })).toEqual({ kind: "alone" });
    expect(familyState({ personId: "mem_a", people: [], invitesReceived: 0 })).toEqual({ kind: "alone" });
  });
});

describe("cleanName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanName("  Mario   Rossi ")).toBe("Mario Rossi");
  });

  it("refuses an empty or too long name", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("a".repeat(NAME_MAX_LENGTH + 1))).toBeNull();
    expect(cleanName("a".repeat(NAME_MAX_LENGTH))).toHaveLength(NAME_MAX_LENGTH);
  });
});

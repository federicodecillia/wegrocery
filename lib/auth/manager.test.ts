import { describe, expect, it } from "vitest";
import { managesCycle } from "./manager";

describe("managesCycle", () => {
  it("lets an admin work on every cycle", () => {
    for (const level of ["utenti", "attivi", "admin"]) expect(managesCycle({ access: "admin", role: "admin" }, level)).toBe(true);
  });

  it("keeps a referent to the cycles their role sees", () => {
    const attivi = { access: "referent" as const, role: "attivi" as const };
    const utenti = { access: "referent" as const, role: "utenti" as const };
    expect(managesCycle(attivi, "utenti")).toBe(true);
    expect(managesCycle(attivi, "attivi")).toBe(true);
    expect(managesCycle(attivi, "admin")).toBe(false);
    expect(managesCycle(utenti, "attivi")).toBe(false);
    expect(managesCycle(utenti, "utenti")).toBe(true);
    // An unknown level is admins only.
    expect(managesCycle(attivi, "strano")).toBe(false);
  });
});

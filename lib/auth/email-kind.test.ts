import { describe, expect, it } from "vitest";
import { authEmailKind, carriesLink } from "./email-kind";

describe("authEmailKind", () => {
  it("sends a link to a member or a card holder, an invitation when an admin asked", () => {
    expect(authEmailKind({ kind: "member", memberId: "m" }, false)).toBe("login");
    expect(authEmailKind({ kind: "provision", via: "card" }, false)).toBe("login");
    expect(authEmailKind({ kind: "provision", via: "open" }, false)).toBe("login");
    expect(authEmailKind({ kind: "member", memberId: "m" }, true)).toBe("invite");
  });

  it("explains a refusal without a link", () => {
    expect(authEmailKind({ kind: "deny", error: "NotMember" }, false)).toBe("notMember");
    expect(authEmailKind({ kind: "deny", error: "AccessDenied" }, false)).toBe("accountInactive");
    expect(authEmailKind({ kind: "deny", error: "MembershipInactive" }, false)).toBe("membershipInactive");
    expect(authEmailKind({ kind: "deny", error: "MembershipCheckUnavailable" }, true)).toBe("checkUnavailable");
    expect(authEmailKind({ kind: "deny", error: "SignupRequired" }, false)).toBe("signupRequired");
    for (const k of ["notMember", "accountInactive", "membershipInactive", "checkUnavailable", "signupRequired"] as const) {
      expect(carriesLink(k)).toBe(false);
    }
  });
});

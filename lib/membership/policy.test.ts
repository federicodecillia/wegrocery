import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_RECHECK_MS,
  evaluateCreditLimit,
  existingMemberSignIn,
  fullNameFromProfile,
  loginErrorPath,
  matchesBootstrapEmail,
  newUserSignIn,
  orderMembershipOutcome,
  raisesOrderTotal,
  shouldRecheckMembershipOnOrder,
} from "./policy";

const now = new Date("2026-09-28T10:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

describe("existingMemberSignIn", () => {
  it("denies inactive members, admins included, without a check", () => {
    expect(existingMemberSignIn({ active: false, role: "admin" }, true, null)).toEqual({ kind: "deny", error: "AccessDenied" });
    expect(existingMemberSignIn({ active: false, role: "utenti" }, true, null)).toEqual({ kind: "deny", error: "AccessDenied" });
  });

  it("lets active admins in without a check", () => {
    expect(existingMemberSignIn({ active: true, role: "admin" }, true, null)).toEqual({ kind: "allow" });
  });

  it("lets active members in when the check is disabled", () => {
    expect(existingMemberSignIn({ active: true, role: "utenti" }, false, null)).toEqual({ kind: "allow" });
  });

  it("asks for a check when enabled and no result yet", () => {
    expect(existingMemberSignIn({ active: true, role: "attivi" }, true, null)).toEqual({ kind: "check" });
  });

  it("valid → allow and record valid", () => {
    expect(existingMemberSignIn({ active: true, role: "utenti" }, true, { status: "valid" })).toEqual({
      kind: "allow",
      record: "valid",
    });
  });

  it("invalid → deny with MembershipInactive and record invalid", () => {
    expect(
      existingMemberSignIn({ active: true, role: "utenti" }, true, { status: "invalid", message: "Data scaduta" }),
    ).toEqual({ kind: "deny", error: "MembershipInactive", record: "invalid" });
  });

  it("error → fail open for existing members", () => {
    expect(existingMemberSignIn({ active: true, role: "utenti" }, true, { status: "error", message: "timeout" })).toEqual({
      kind: "allow",
      logError: true,
    });
  });
});

describe("matchesBootstrapEmail", () => {
  it("matches the configured address, ignoring case and spaces", () => {
    expect(matchesBootstrapEmail("anna@example.org", " Anna@Example.org ")).toBe(true);
  });
  it("never matches when the variable is unset or blank, or for another address", () => {
    expect(matchesBootstrapEmail("anna@example.org", undefined)).toBe(false);
    expect(matchesBootstrapEmail("anna@example.org", "  ")).toBe(false);
    expect(matchesBootstrapEmail("bruno@example.org", "anna@example.org")).toBe(false);
  });
});

describe("newUserSignIn", () => {
  it("denies as today when the check is disabled", () => {
    expect(newUserSignIn(false, null)).toEqual({ kind: "deny", error: "AccessDenied" });
  });
  it("asks for a check when enabled", () => {
    expect(newUserSignIn(true, null)).toEqual({ kind: "check" });
  });
  it("valid → provision", () => {
    expect(newUserSignIn(true, { status: "valid" })).toEqual({ kind: "provision" });
  });
  it("invalid → NotMember", () => {
    expect(newUserSignIn(true, { status: "invalid", message: "x" })).toEqual({ kind: "deny", error: "NotMember" });
  });
  it("never provisions (nor checks) an email Google has not verified", () => {
    expect(newUserSignIn(true, null, false)).toEqual({ kind: "deny", error: "AccessDenied" });
    expect(newUserSignIn(true, { status: "valid" }, false)).toEqual({ kind: "deny", error: "AccessDenied" });
  });
  it("error → MembershipCheckUnavailable (fail closed for strangers)", () => {
    expect(newUserSignIn(true, { status: "error", message: "x" })).toEqual({
      kind: "deny",
      error: "MembershipCheckUnavailable",
      logError: true,
    });
  });
});

describe("loginErrorPath", () => {
  it("builds the login URL with the error code", () => {
    expect(loginErrorPath("NotMember")).toBe("/login?error=NotMember");
  });
  it("adds the attempted email, encoded", () => {
    expect(loginErrorPath("NotMember", "a+b@x.it")).toBe("/login?error=NotMember&email=a%2Bb%40x.it");
  });
});

describe("fullNameFromProfile", () => {
  it("prefers the profile name", () => {
    expect(fullNameFromProfile("  Maria Rossi ", "m@x.it")).toBe("Maria Rossi");
  });
  it("falls back to the email local part", () => {
    expect(fullNameFromProfile(null, "maria.rossi@x.it")).toBe("maria.rossi");
    expect(fullNameFromProfile("   ", "maria@x.it")).toBe("maria");
  });
});

describe("shouldRecheckMembershipOnOrder", () => {
  const base = { role: "utenti", membershipStatus: "valid" as string | null, membershipVerifiedAt: hoursAgo(1) as Date | null };

  it("never rechecks when the check is disabled", () => {
    expect(shouldRecheckMembershipOnOrder({ ...base, membershipVerifiedAt: null }, false, now, true)).toBe(false);
  });
  it("never rechecks admins", () => {
    expect(shouldRecheckMembershipOnOrder({ ...base, role: "admin", membershipVerifiedAt: null }, true, now, true)).toBe(false);
  });
  it("skips a recent valid check", () => {
    expect(shouldRecheckMembershipOnOrder(base, true, now, true)).toBe(false);
  });
  it("rechecks after 24h", () => {
    expect(
      shouldRecheckMembershipOnOrder({ ...base, membershipVerifiedAt: new Date(now.getTime() - MEMBERSHIP_RECHECK_MS - 1) }, true, now, true),
    ).toBe(true);
  });
  it("rechecks when never verified", () => {
    expect(shouldRecheckMembershipOnOrder({ ...base, membershipStatus: null, membershipVerifiedAt: null }, true, now, true)).toBe(true);
  });
  it("never rechecks a save that only trims or cancels the order", () => {
    expect(shouldRecheckMembershipOnOrder({ ...base, membershipStatus: "invalid", membershipVerifiedAt: null }, true, now, false)).toBe(false);
  });
  it("rechecks a recent invalid result, so a renewal takes effect at once", () => {
    expect(shouldRecheckMembershipOnOrder({ ...base, membershipStatus: "invalid" }, true, now, true)).toBe(true);
  });
});

describe("orderMembershipOutcome", () => {
  it("valid → allow and record", () => {
    expect(orderMembershipOutcome({ status: "valid" })).toEqual({ allow: true, record: "valid" });
  });
  it("invalid → block and record", () => {
    expect(orderMembershipOutcome({ status: "invalid", message: "Data scaduta" })).toEqual({ allow: false, record: "invalid" });
  });
  it("error → allow without recording", () => {
    expect(orderMembershipOutcome({ status: "error", message: "timeout" })).toEqual({ allow: true, record: null });
  });
});

describe("raisesOrderTotal", () => {
  it("compares in cents", () => {
    expect(raisesOrderTotal(10, 10.01)).toBe(true);
    expect(raisesOrderTotal(10, 10)).toBe(false);
    expect(raisesOrderTotal(0.1 + 0.2, 0.3)).toBe(false);
    expect(raisesOrderTotal(30, 0)).toBe(false);
    expect(raisesOrderTotal(0, 0.01)).toBe(true);
  });
});

describe("evaluateCreditLimit", () => {
  const base = { balance: 0, openOrdersOtherCycles: 0, previousOrderTotal: 0, newOrderTotal: 0, minBalance: -50 as number | null };

  it("always allows when there is no limit", () => {
    expect(evaluateCreditLimit({ ...base, minBalance: null, newOrderTotal: 1000 })).toEqual({ ok: true });
  });

  it("allows down to exactly the limit", () => {
    expect(evaluateCreditLimit({ ...base, newOrderTotal: 50 })).toEqual({ ok: true });
  });

  it("blocks one cent past the limit and reports what is still available", () => {
    expect(evaluateCreditLimit({ ...base, newOrderTotal: 50.01 })).toEqual({ ok: false, available: 50 });
  });

  it("counts orders on other open cycles", () => {
    expect(evaluateCreditLimit({ ...base, balance: 20, openOrdersOtherCycles: 30, newOrderTotal: 45 })).toEqual({
      ok: false,
      available: 40,
    });
  });

  it("with a zero limit, a member at zero cannot order", () => {
    expect(evaluateCreditLimit({ ...base, minBalance: 0, newOrderTotal: 1 })).toEqual({ ok: false, available: 0 });
  });

  it("never reports a negative available amount", () => {
    expect(evaluateCreditLimit({ ...base, balance: -80, newOrderTotal: 5 })).toEqual({ ok: false, available: 0 });
  });

  it("lets a member already past the limit shrink or keep their order", () => {
    expect(evaluateCreditLimit({ ...base, balance: -80, previousOrderTotal: 30, newOrderTotal: 20 })).toEqual({ ok: true });
    expect(evaluateCreditLimit({ ...base, balance: -80, previousOrderTotal: 30, newOrderTotal: 30 })).toEqual({ ok: true });
    expect(evaluateCreditLimit({ ...base, balance: -80, previousOrderTotal: 30, newOrderTotal: 0 })).toEqual({ ok: true });
  });

  it("is not fooled by float noise", () => {
    expect(evaluateCreditLimit({ ...base, balance: 0.1 + 0.2, minBalance: 0, newOrderTotal: 0.3 })).toEqual({ ok: true });
  });
});

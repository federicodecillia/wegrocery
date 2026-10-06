import { describe, expect, it } from "vitest";
import { checkAccess, sessionClaims } from "./access";

const admin = { email: "anna@example.com", role: "admin", active: true };
const member = { email: "marco@example.com", role: "utenti", active: true };

describe("checkAccess", () => {
  it("lets an active member in", () => {
    expect(checkAccess(member, "member")).toEqual({ ok: true });
  });

  it("lets an active admin in, as admin and as member", () => {
    expect(checkAccess(admin, "admin")).toEqual({ ok: true });
    expect(checkAccess(admin, "member")).toEqual({ ok: true });
  });

  it("denies a missing session or one without an email", () => {
    expect(checkAccess(null, "member")).toEqual({ ok: false, reason: "unauthenticated" });
    expect(checkAccess(undefined, "admin")).toEqual({ ok: false, reason: "unauthenticated" });
    expect(checkAccess({ ...admin, email: "" }, "admin")).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("denies a deactivated member, admins included", () => {
    expect(checkAccess({ ...member, active: false }, "member")).toEqual({ ok: false, reason: "inactive" });
    expect(checkAccess({ ...admin, active: false }, "admin")).toEqual({ ok: false, reason: "inactive" });
  });

  it("fails closed when the active flag is missing", () => {
    expect(checkAccess({ email: admin.email, role: "admin" }, "admin")).toEqual({ ok: false, reason: "inactive" });
  });

  it("keeps non-admin roles out of admin access", () => {
    expect(checkAccess(member, "admin")).toEqual({ ok: false, reason: "notAdmin" });
    expect(checkAccess({ ...member, role: "attivi" }, "admin")).toEqual({ ok: false, reason: "notAdmin" });
    expect(checkAccess({ ...member, role: null }, "admin")).toEqual({ ok: false, reason: "notAdmin" });
  });
});

describe("sessionClaims", () => {
  const row = { memberId: "mem_1", role: "attivi", active: true, fullName: "Marco" };

  it("refreshes role, active, memberId and name from an active member row", () => {
    expect(sessionClaims(row)).toEqual({ memberId: "mem_1", personId: "mem_1", role: "attivi", active: true, fullName: "Marco" });
  });

  it("ends the session of a deactivated member", () => {
    expect(sessionClaims({ ...row, active: false })).toBeNull();
  });

  it("ends the session when the member row is gone", () => {
    expect(sessionClaims(null)).toBeNull();
    expect(sessionClaims(undefined)).toBeNull();
  });
});

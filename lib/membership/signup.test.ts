import { describe, expect, it } from "vitest";
import { effectiveMinBalance, isBotSubmission, isSignupMode, isSignupRole, validateRequest, type RequestInput } from "./signup";

const base: RequestInput = {
  fullName: "  Anna   Verdi ",
  email: " Anna@Example.org ",
  phone: "",
  note: "",
  website: "",
  acceptTerms: false,
};

describe("validateRequest", () => {
  it("trims the fields and lower-cases the address", () => {
    expect(validateRequest(base, false)).toEqual({
      ok: true,
      value: { fullName: "Anna Verdi", email: "anna@example.org", phone: null, note: null },
    });
  });
  it("refuses a missing name or a malformed address", () => {
    expect(validateRequest({ ...base, fullName: "  " }, false)).toEqual({ ok: false, field: "name" });
    expect(validateRequest({ ...base, email: "anna" }, false)).toEqual({ ok: false, field: "email" });
    expect(validateRequest({ ...base, email: "anna@example" }, false)).toEqual({ ok: false, field: "email" });
  });
  it("keeps an optional phone and note within their limits", () => {
    expect(validateRequest({ ...base, phone: "+39 333 123 4567", note: " Ciao " }, false)).toMatchObject({
      ok: true,
      value: { phone: "+39 333 123 4567", note: "Ciao" },
    });
    expect(validateRequest({ ...base, phone: "call me" }, false)).toEqual({ ok: false, field: "phone" });
    expect(validateRequest({ ...base, note: "x".repeat(501) }, false)).toEqual({ ok: false, field: "note" });
    expect(validateRequest({ ...base, fullName: "x".repeat(121) }, false)).toEqual({ ok: false, field: "name" });
  });
  it("asks for the terms only when the group requires them", () => {
    expect(validateRequest(base, true)).toEqual({ ok: false, field: "terms" });
    expect(validateRequest({ ...base, acceptTerms: true }, true).ok).toBe(true);
  });
});

describe("isBotSubmission", () => {
  it("is the honeypot field filled in", () => {
    expect(isBotSubmission({ website: "" })).toBe(false);
    expect(isBotSubmission({ website: "http://spam" })).toBe(true);
  });
});

describe("effectiveMinBalance", () => {
  it("keeps the group's limit for members who did not sign up", () => {
    expect(effectiveMinBalance(-30, { joinedVia: null }, true)).toBe(-30);
    expect(effectiveMinBalance(null, { joinedVia: null }, true)).toBeNull();
  });
  it("is zero for a newcomer of a prepaid group, even with no group limit", () => {
    expect(effectiveMinBalance(-30, { joinedVia: "request" }, true)).toBe(0);
    expect(effectiveMinBalance(null, { joinedVia: "open" }, true)).toBe(0);
  });
  it("gives newcomers the group's limit when prepaid is off", () => {
    expect(effectiveMinBalance(-30, { joinedVia: "open" }, false)).toBe(-30);
    expect(effectiveMinBalance(null, { joinedVia: "request" }, false)).toBeNull();
  });
});

describe("guards", () => {
  it("knows the modes and the roles, never admin", () => {
    expect(["closed", "request", "open"].every(isSignupMode)).toBe(true);
    expect(isSignupMode("public")).toBe(false);
    expect(isSignupRole("utenti") && isSignupRole("attivi")).toBe(true);
    expect(isSignupRole("admin")).toBe(false);
  });
});

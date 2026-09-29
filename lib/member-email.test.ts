import { describe, expect, it } from "vitest";
import { findEmailConflict, normalizeEmail } from "./member-email";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Mario.Rossi@Example.COM ")).toBe("mario.rossi@example.com");
  });

  it("returns null for a blank or missing value", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("findEmailConflict", () => {
  const anna = { memberId: "mem_anna", fullName: "Anna Bianchi", email: "anna@example.com", aliasEmail: "anna@gmail.com" };
  const marco = { memberId: "mem_marco", fullName: "Marco Verdi", email: "marco@example.com", aliasEmail: null };
  const others = [anna, marco];

  it("finds nothing when no other member holds the addresses", () => {
    expect(findEmailConflict(undefined, { email: "nuovo@example.com", aliasEmail: null }, others)).toBeNull();
    expect(findEmailConflict(undefined, { email: "nuovo@example.com", aliasEmail: "nuovo@gmail.com" }, others)).toBeNull();
  });

  it("rejects an email that is another member's email, ignoring case", () => {
    expect(findEmailConflict(undefined, { email: "Anna@Example.com", aliasEmail: null }, others)).toEqual({
      address: "anna@example.com",
      memberId: "mem_anna",
      fullName: "Anna Bianchi",
    });
  });

  it("rejects an email that is another member's alias", () => {
    expect(findEmailConflict("mem_marco", { email: "anna@gmail.com", aliasEmail: null }, others)).toEqual({
      address: "anna@gmail.com",
      memberId: "mem_anna",
      fullName: "Anna Bianchi",
    });
  });

  it("rejects an alias that is another member's email", () => {
    expect(findEmailConflict("mem_anna", { email: "anna@example.com", aliasEmail: "marco@example.com" }, others)).toEqual({
      address: "marco@example.com",
      memberId: "mem_marco",
      fullName: "Marco Verdi",
    });
  });

  it("rejects an alias that is another member's alias", () => {
    expect(findEmailConflict(undefined, { email: "nuovo@example.com", aliasEmail: "ANNA@gmail.com " }, others)).toEqual({
      address: "anna@gmail.com",
      memberId: "mem_anna",
      fullName: "Anna Bianchi",
    });
  });

  it("ignores the member being edited, also when email and alias are swapped", () => {
    expect(findEmailConflict("mem_anna", { email: "anna@example.com", aliasEmail: "anna@gmail.com" }, others)).toBeNull();
    expect(findEmailConflict("mem_anna", { email: "anna@gmail.com", aliasEmail: "anna@example.com" }, others)).toBeNull();
  });

  it("never matches a missing alias against another member's missing alias", () => {
    expect(findEmailConflict(undefined, { email: "nuovo@example.com", aliasEmail: null }, [marco])).toBeNull();
  });

  it("reports the email before the alias when both are taken", () => {
    expect(findEmailConflict(undefined, { email: "marco@example.com", aliasEmail: "anna@gmail.com" }, others)).toMatchObject({
      address: "marco@example.com",
    });
  });
});

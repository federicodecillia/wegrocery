import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors";

// Shape of a Postgres error from the Neon driver, and of drizzle's
// DrizzleQueryError, which wraps it as `cause`.
const pgError = (code: string) => Object.assign(new Error("duplicate key value"), { code, constraint: "members_email_lower_uniq" });
const drizzleError = (cause: unknown) => Object.assign(new Error("Failed query: insert into ..."), { cause });

describe("isUniqueViolation", () => {
  it("recognises a Postgres unique violation", () => {
    expect(isUniqueViolation(pgError("23505"))).toBe(true);
  });

  it("recognises it wrapped by drizzle", () => {
    expect(isUniqueViolation(drizzleError(pgError("23505")))).toBe(true);
  });

  it("ignores other database errors", () => {
    expect(isUniqueViolation(pgError("23503"))).toBe(false);
    expect(isUniqueViolation(drizzleError(pgError("22012")))).toBe(false);
  });

  it("ignores anything that is not a database error", () => {
    expect(isUniqueViolation(new Error("23505"))).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

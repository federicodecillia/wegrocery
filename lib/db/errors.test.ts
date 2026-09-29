import { describe, expect, it } from "vitest";
import { EXTERNAL_REF_UNIQUE_INDEX } from "@/lib/ledger";
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

describe("isUniqueViolation of a named constraint", () => {
  const neonError = { code: "23505", constraint: EXTERNAL_REF_UNIQUE_INDEX };

  it("recognises the violation wrapped by drizzle (DrizzleQueryError.cause)", () => {
    const wrapped = Object.assign(new Error("Failed query: insert into ..."), { cause: neonError });
    expect(isUniqueViolation(wrapped, EXTERNAL_REF_UNIQUE_INDEX)).toBe(true);
  });

  it("recognises the driver error itself", () => {
    expect(isUniqueViolation(neonError, EXTERNAL_REF_UNIQUE_INDEX)).toBe(true);
  });

  it("ignores other constraints and other errors", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "members_email_unique" }, EXTERNAL_REF_UNIQUE_INDEX)).toBe(
      false,
    );
    expect(isUniqueViolation({ code: "23514", constraint: EXTERNAL_REF_UNIQUE_INDEX }, EXTERNAL_REF_UNIQUE_INDEX)).toBe(
      false,
    );
    expect(isUniqueViolation(new Error("boom"), EXTERNAL_REF_UNIQUE_INDEX)).toBe(false);
    expect(isUniqueViolation(null, EXTERNAL_REF_UNIQUE_INDEX)).toBe(false);
    expect(isUniqueViolation("23505", EXTERNAL_REF_UNIQUE_INDEX)).toBe(false);
  });

  it("does not loop on a cyclic cause chain", () => {
    const a: { cause?: unknown } = {};
    a.cause = { cause: a };
    expect(isUniqueViolation(a, EXTERNAL_REF_UNIQUE_INDEX)).toBe(false);
  });
});

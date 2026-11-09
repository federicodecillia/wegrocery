import { describe, expect, it } from "vitest";
import { cronAuthorized, openingDue } from "./cron-auth";

const SECRET = "s".repeat(40);

describe("cronAuthorized", () => {
  it("accepts only the bearer of a long enough secret", () => {
    expect(cronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(cronAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(cronAuthorized(SECRET, SECRET)).toBe(false);
    expect(cronAuthorized(null, SECRET)).toBe(false);
  });

  it("stays closed without a secret or with a short one", () => {
    expect(cronAuthorized("Bearer ", undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
    expect(cronAuthorized("Bearer short", "short")).toBe(false);
  });
});

describe("openingDue", () => {
  const now = new Date("2026-11-24T08:00:30Z");
  it("is due from the planned minute on, never without a planned opening", () => {
    expect(openingDue("2026-11-24T08:00:00.000Z", now)).toBe(true);
    expect(openingDue("2026-11-24T08:01:00.000Z", now)).toBe(false);
    expect(openingDue(null, now)).toBe(false);
  });
});

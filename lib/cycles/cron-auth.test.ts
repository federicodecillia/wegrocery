import { describe, expect, it } from "vitest";
import { autoOpenEnabled, cronAuthorized } from "./cron-auth";

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

describe("autoOpenEnabled", () => {
  it("needs a long enough CRON_SECRET", () => {
    expect(autoOpenEnabled({ CRON_SECRET: SECRET })).toBe(true);
    expect(autoOpenEnabled({ CRON_SECRET: "short" })).toBe(false);
    expect(autoOpenEnabled({})).toBe(false);
  });
});

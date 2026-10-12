import { describe, expect, it } from "vitest";
import { MAX_SKEW_SECONDS, signRequest, verifyRequest } from "./signature";

const secret = "a".repeat(64);
const path = "/api/instance-stats";
const now = 1_800_000_000;

function input(overrides: Partial<Parameters<typeof verifyRequest>[0]> = {}) {
  const timestamp = String(now);
  return {
    secret,
    timestamp,
    signature: signRequest(secret, timestamp, "GET", path),
    method: "GET",
    path,
    nowSeconds: now,
    ...overrides,
  };
}

describe("verifyRequest", () => {
  it("accepts a fresh, correctly signed request", () => {
    expect(verifyRequest(input())).toBe(true);
  });

  it("refuses when the deploy has no secret or a short one", () => {
    expect(verifyRequest(input({ secret: undefined }))).toBe(false);
    expect(verifyRequest(input({ secret: "  " }))).toBe(false);
    const short = "s".repeat(16);
    expect(verifyRequest(input({ secret: short, signature: signRequest(short, String(now), "GET", path) }))).toBe(false);
  });

  it("refuses a wrong key, path or method", () => {
    expect(verifyRequest(input({ signature: signRequest("b".repeat(64), String(now), "GET", path) }))).toBe(false);
    expect(verifyRequest(input({ path: "/api/other" }))).toBe(false);
    expect(verifyRequest(input({ method: "POST" }))).toBe(false);
  });

  it("refuses a stale or future timestamp", () => {
    expect(verifyRequest(input({ nowSeconds: now + MAX_SKEW_SECONDS + 1 }))).toBe(false);
    expect(verifyRequest(input({ nowSeconds: now - MAX_SKEW_SECONDS - 1 }))).toBe(false);
    expect(verifyRequest(input({ nowSeconds: now + MAX_SKEW_SECONDS }))).toBe(true);
  });

  it("refuses malformed headers", () => {
    expect(verifyRequest(input({ timestamp: null }))).toBe(false);
    expect(verifyRequest(input({ timestamp: "12a" }))).toBe(false);
    expect(verifyRequest(input({ signature: null }))).toBe(false);
    expect(verifyRequest(input({ signature: "zz" }))).toBe(false);
    expect(verifyRequest(input({ signature: "A".repeat(64) }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_SKEW_SECONDS, signRequest, verifiedContract, verifyRequest } from "./signature";

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

describe("signRequest", () => {
  // The vector of the FlyLabs Kit module `console` and of the Console's own
  // test, made with openssl: both sides check against the same number.
  //   printf '%s' '1700000000.GET./api/instance-stats' \
  //     | openssl dgst -sha256 -hmac 'test-secret-0123456789abcdef0123456789'
  it("matches the Console's known vector", () => {
    expect(signRequest("test-secret-0123456789abcdef0123456789", "1700000000", "GET", path)).toBe(
      "5e7bea8559a8ce2f534d172c70f2af6d322ab0c94f4160c424ecac30b1641a59",
    );
  });
});

describe("verifiedContract", () => {
  const base = { secret, method: "GET", path, nowSeconds: now };
  const signature = signRequest(secret, String(now), "GET", path);
  const headers = (h: Record<string, string>) => new Headers(h);

  it("answers the kit's contract to x-flylabs-* headers", () => {
    expect(verifiedContract(headers({ "x-flylabs-timestamp": String(now), "x-flylabs-signature": signature }), base)).toBe("flylabs");
  });

  it("still answers the WeGrocery Console's x-wegrocery-* headers", () => {
    expect(verifiedContract(headers({ "x-wegrocery-timestamp": String(now), "x-wegrocery-signature": signature }), base)).toBe("wegrocery");
  });

  it("prefers the kit's headers when a console sends both", () => {
    const both = {
      "x-flylabs-timestamp": String(now),
      "x-flylabs-signature": signature,
      "x-wegrocery-timestamp": String(now),
      "x-wegrocery-signature": signature,
    };
    expect(verifiedContract(headers(both), base)).toBe("flylabs");
  });

  it("refuses no headers, a bad signature and mixed pairs", () => {
    expect(verifiedContract(headers({}), base)).toBeNull();
    expect(verifiedContract(headers({ "x-flylabs-timestamp": String(now), "x-flylabs-signature": "0".repeat(64) }), base)).toBeNull();
    expect(verifiedContract(headers({ "x-flylabs-timestamp": String(now), "x-wegrocery-signature": signature }), base)).toBeNull();
    expect(verifiedContract(headers({ "x-flylabs-timestamp": String(now), "x-flylabs-signature": signature }), { ...base, secret: undefined })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { signedStatsHeaders, statsSignature } from "./signature";

// Vector computed independently with:
//   printf '%s' '1700000000.GET./api/instance-stats' \
//     | openssl dgst -sha256 -hmac 'test-secret-0123456789abcdef0123456789'
const SECRET = "test-secret-0123456789abcdef0123456789";
const EXPECTED = "5e7bea8559a8ce2f534d172c70f2af6d322ab0c94f4160c424ecac30b1641a59";

describe("stats signature", () => {
  it("matches the known vector", () => {
    expect(statsSignature(SECRET, 1_700_000_000)).toBe(EXPECTED);
  });

  it("builds the two headers, timestamp in whole seconds", () => {
    expect(signedStatsHeaders(SECRET, 1_700_000_000.9)).toEqual({
      "x-wegrocery-timestamp": "1700000000",
      "x-wegrocery-signature": EXPECTED,
    });
  });

  it("changes with the timestamp", () => {
    expect(statsSignature(SECRET, 1_700_000_001)).not.toBe(EXPECTED);
  });

  it("refuses a secret shorter than 32 characters", () => {
    expect(() => signedStatsHeaders("short", 1)).toThrow();
  });
});

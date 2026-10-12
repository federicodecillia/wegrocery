import { describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, createSessionToken, safeEqual, verifySessionToken } from "./session-token";

const SECRET = "s".repeat(40);
const PASSWORD = "correct horse battery staple";
const NOW = 1_800_000_000;

describe("session token", () => {
  it("verifies a fresh token", () => {
    const { token, expiresAt } = createSessionToken(SECRET, PASSWORD, NOW, "nonce");
    expect(expiresAt).toBe(NOW + SESSION_TTL_SECONDS);
    expect(verifySessionToken(token, SECRET, PASSWORD, NOW + 60)).toBe(true);
  });

  it("expires after 12 hours", () => {
    const { token } = createSessionToken(SECRET, PASSWORD, NOW);
    expect(verifySessionToken(token, SECRET, PASSWORD, NOW + SESSION_TTL_SECONDS)).toBe(false);
  });

  it("rejects a token signed with another secret or password", () => {
    const { token } = createSessionToken(SECRET, PASSWORD, NOW);
    expect(verifySessionToken(token, "x".repeat(40), PASSWORD, NOW)).toBe(false);
    expect(verifySessionToken(token, SECRET, "another password!!", NOW)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const { token } = createSessionToken(SECRET, PASSWORD, NOW);
    const parts = token.split(".");
    parts[1] = String(Number(parts[1]) + 3600);
    expect(verifySessionToken(parts.join("."), SECRET, PASSWORD, NOW)).toBe(false);
  });

  it("rejects garbage", () => {
    for (const t of [undefined, null, "", "v1", "v1.a.b.c", "v2.1.2.3"]) {
      expect(verifySessionToken(t, SECRET, PASSWORD, NOW)).toBe(false);
    }
  });

  it("compares strings safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

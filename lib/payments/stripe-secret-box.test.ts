import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./stripe-secret-box";

const secret = "a-long-random-auth-secret-for-tests-only";

describe("stripe secret box", () => {
  it("opens what it sealed, and never stores the plain value", () => {
    const sealed = sealSecret("rk_test_abc123", "secret_key", secret);
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain("abc123");
    expect(openSecret(sealed, "secret_key", secret)).toBe("rk_test_abc123");
  });

  it("uses a new IV every time", () => {
    expect(sealSecret("whsec_x", "webhook_secret", secret)).not.toBe(sealSecret("whsec_x", "webhook_secret", secret));
  });

  it("returns null for another AUTH_SECRET or none", () => {
    const sealed = sealSecret("rk_test_abc123", "secret_key", secret);
    expect(openSecret(sealed, "secret_key", "rotated-secret-of-the-same-deploy")).toBeNull();
    expect(openSecret(sealed, "secret_key", undefined)).toBeNull();
    expect(openSecret(sealed, "secret_key", "")).toBeNull();
  });

  it("returns null for a value sealed for the other field", () => {
    const sealed = sealSecret("whsec_x", "webhook_secret", secret);
    expect(openSecret(sealed, "secret_key", secret)).toBeNull();
  });

  it("returns null for a tampered or malformed value", () => {
    const sealed = sealSecret("rk_test_abc123", "secret_key", secret);
    const [v, iv, tag, ct] = sealed.split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(openSecret([v, iv, tag, flipped.toString("base64url")].join("."), "secret_key", secret)).toBeNull();
    expect(openSecret([v, iv, Buffer.alloc(16).toString("base64url"), ct].join("."), "secret_key", secret)).toBeNull();
    expect(openSecret(["v2", iv, tag, ct].join("."), "secret_key", secret)).toBeNull();
    expect(openSecret("not sealed", "secret_key", secret)).toBeNull();
    expect(openSecret("v1.a.b.c", "secret_key", secret)).toBeNull();
  });

  it("refuses to seal without AUTH_SECRET", () => {
    expect(() => sealSecret("x", "secret_key", "")).toThrow();
  });
});

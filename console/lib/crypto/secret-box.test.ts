import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, parseKey } from "./secret-box";

const HEX_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("parseKey", () => {
  it("accepts 64 hex characters", () => {
    expect(parseKey(HEX_KEY)).toHaveLength(32);
  });
  it("accepts base64 of 32 bytes", () => {
    expect(parseKey(Buffer.alloc(32, 7).toString("base64"))).toHaveLength(32);
  });
  it("refuses anything else", () => {
    expect(() => parseKey("short")).toThrow();
    expect(() => parseKey("")).toThrow();
    expect(() => parseKey(null)).toThrow();
  });
});

describe("secret box", () => {
  const key = parseKey(HEX_KEY);

  it("round-trips", () => {
    const enc = encryptSecret("my-stats-secret", key, "ins_1");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("my-stats-secret");
    expect(decryptSecret(enc, key, "ins_1")).toBe("my-stats-secret");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("x", key, "a")).not.toBe(encryptSecret("x", key, "a"));
  });

  it("fails with another context (instance id)", () => {
    const enc = encryptSecret("secret", key, "ins_1");
    expect(() => decryptSecret(enc, key, "ins_2")).toThrow();
  });

  it("fails with another key or tampered ciphertext", () => {
    const enc = encryptSecret("secret", key, "ins_1");
    expect(() => decryptSecret(enc, parseKey("f".repeat(64)), "ins_1")).toThrow();
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), key, "ins_1")).toThrow();
  });
});

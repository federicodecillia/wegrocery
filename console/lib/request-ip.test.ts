import { describe, expect, it } from "vitest";
import { clientIp, hashIp, underLimit } from "./request-ip";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("clientIp", () => {
  it("prefers the Vercel header", () => {
    expect(clientIp(h({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });
  it("falls back to one shared bucket", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is stable, keyed and not the address", () => {
    expect(hashIp("1.2.3.4", "k")).toBe(hashIp("1.2.3.4", "k"));
    expect(hashIp("1.2.3.4", "k")).not.toBe(hashIp("1.2.3.4", "other"));
    expect(hashIp("1.2.3.4", "k")).not.toContain("1.2.3.4");
  });
});

describe("underLimit", () => {
  it("allows up to the maximum", () => {
    expect(underLimit(4, 5)).toBe(true);
    expect(underLimit(5, 5)).toBe(false);
  });
});

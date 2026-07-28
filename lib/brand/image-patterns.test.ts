import { describe, expect, it } from "vitest";
import { brandImagePatterns } from "./image-patterns";

describe("brandImagePatterns", () => {
  it("allows exactly the brand logo's host and path", () => {
    const raw = JSON.stringify({
      appName: "GAS Porta Moneta",
      logoUrl: "https://raw.githubusercontent.com/federicodecillia/wegrocery/main/public/logo.png",
    });
    expect(brandImagePatterns(raw)).toEqual([
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/federicodecillia/wegrocery/main/public/logo.png",
      },
    ]);
  });

  it("allows nothing when the deployment uses the default brand", () => {
    expect(brandImagePatterns(undefined)).toEqual([]);
  });

  it("allows nothing for a relative logo, which is served locally", () => {
    expect(brandImagePatterns(JSON.stringify({ logoUrl: "/logo.png" }))).toEqual([]);
  });

  it("rejects a plain-http logo rather than allowing the host", () => {
    expect(brandImagePatterns(JSON.stringify({ logoUrl: "http://example.com/logo.png" }))).toEqual([]);
  });

  it("allows nothing when the brand config is malformed or has no logo", () => {
    expect(brandImagePatterns("{not json")).toEqual([]);
    expect(brandImagePatterns(JSON.stringify({ appName: "X" }))).toEqual([]);
    expect(brandImagePatterns(JSON.stringify({ logoUrl: 42 }))).toEqual([]);
  });

  it("never returns a wildcard host", () => {
    const raw = JSON.stringify({ logoUrl: "https://cdn.example.com/a/b/logo.svg" });
    for (const p of brandImagePatterns(raw)) {
      expect(p.hostname).not.toContain("*");
      expect(p.pathname).not.toContain("*");
    }
  });
});

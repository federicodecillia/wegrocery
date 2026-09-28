import { describe, it, expect } from "vitest";
import { parseBrandConfig } from "./parse";
import { DEFAULT_BRAND } from "./default";

describe("parseBrandConfig", () => {
  it("returns default brand when env is undefined", () => {
    expect(parseBrandConfig(undefined)).toEqual(DEFAULT_BRAND);
  });

  it("returns default brand when env is empty string", () => {
    expect(parseBrandConfig("")).toEqual(DEFAULT_BRAND);
  });

  it("overlays partial config on defaults", () => {
    const b = parseBrandConfig(JSON.stringify({ appName: "Porta Moneta GAS", locale: "it" }));
    expect(b.appName).toBe("Porta Moneta GAS");
    expect(b.locale).toBe("it");
    expect(b.currency).toBe("EUR"); // default preserved
  });

  it("deep-merges theme", () => {
    const b = parseBrandConfig(JSON.stringify({ theme: { primary: "#ff0000" } }));
    expect(b.theme.primary).toBe("#ff0000");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseBrandConfig("{not json")).toThrow(/not valid JSON/);
  });

  it("throws on non-object JSON", () => {
    expect(() => parseBrandConfig('"hello"')).toThrow(/must be a JSON object/);
  });

  it("throws on invalid locale", () => {
    expect(() => parseBrandConfig(JSON.stringify({ locale: "fr" }))).toThrow(/locale/);
  });

  it("throws on non-string field", () => {
    expect(() => parseBrandConfig(JSON.stringify({ appName: 42 }))).toThrow(/appName/);
  });

  it("throws on non-boolean headerShowName", () => {
    expect(() => parseBrandConfig(JSON.stringify({ headerShowName: "yes" }))).toThrow(/headerShowName/);
  });

  it("defaults privacyUrl, membershipUrl and minBalance to null", () => {
    const b = parseBrandConfig(JSON.stringify({ appName: "X" }));
    expect(b.privacyUrl).toBeNull();
    expect(b.membershipUrl).toBeNull();
    expect(b.minBalance).toBeNull();
  });

  it("accepts privacyUrl, membershipUrl and minBalance", () => {
    const b = parseBrandConfig(
      JSON.stringify({
        privacyUrl: "https://example.org/privacy",
        membershipUrl: "https://example.org/tesseramento",
        minBalance: -50,
      }),
    );
    expect(b.privacyUrl).toBe("https://example.org/privacy");
    expect(b.membershipUrl).toBe("https://example.org/tesseramento");
    expect(b.minBalance).toBe(-50);
  });

  it("accepts explicit nulls for the optional fields", () => {
    const b = parseBrandConfig(JSON.stringify({ privacyUrl: null, membershipUrl: null, minBalance: null }));
    expect(b.privacyUrl).toBeNull();
    expect(b.membershipUrl).toBeNull();
    expect(b.minBalance).toBeNull();
  });

  it("throws on non-string privacyUrl / membershipUrl", () => {
    expect(() => parseBrandConfig(JSON.stringify({ privacyUrl: 1 }))).toThrow(/privacyUrl/);
    expect(() => parseBrandConfig(JSON.stringify({ membershipUrl: true }))).toThrow(/membershipUrl/);
  });

  it("throws on relative, empty or non-http(s) privacyUrl / membershipUrl", () => {
    expect(() => parseBrandConfig(JSON.stringify({ privacyUrl: "/privacy" }))).toThrow(/privacyUrl/);
    expect(() => parseBrandConfig(JSON.stringify({ privacyUrl: "" }))).toThrow(/privacyUrl/);
    expect(() => parseBrandConfig(JSON.stringify({ membershipUrl: "javascript:alert(1)" }))).toThrow(/membershipUrl/);
  });

  it("throws on non-finite or non-number minBalance", () => {
    expect(() => parseBrandConfig(JSON.stringify({ minBalance: "-50" }))).toThrow(/minBalance/);
    expect(() => parseBrandConfig('{"minBalance": 1e999}')).toThrow(/minBalance/);
  });
});

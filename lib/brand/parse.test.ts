import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { brandUnknownFields, parseBrandConfig } from "./parse";
import { brandContrastWarnings } from "./roles";
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

  it("accepts bankTransfer and defaults it to null", () => {
    expect(parseBrandConfig(JSON.stringify({})).bankTransfer).toBeNull();
    const b = parseBrandConfig(
      JSON.stringify({ bankTransfer: { holder: "Example APS", iban: "IT60 X054 2811 1010 0000 0123 456" } }),
    );
    expect(b.bankTransfer?.holder).toBe("Example APS");
  });

  it("throws on an incomplete bankTransfer or a malformed IBAN", () => {
    expect(() => parseBrandConfig(JSON.stringify({ bankTransfer: { holder: "X" } }))).toThrow(/bankTransfer/);
    expect(() =>
      parseBrandConfig(JSON.stringify({ bankTransfer: { holder: "X", iban: "not an iban" } })),
    ).toThrow(/bankTransfer/);
    expect(() => parseBrandConfig(JSON.stringify({ bankTransfer: "IT60..." }))).toThrow(/bankTransfer/);
  });
});

describe("brandUnknownFields", () => {
  it("names the fields the app does not read, typos included", () => {
    const raw = JSON.stringify({ appname: "GAS", locale: "it", theme: { primary: "#000", secondary: "#fff" } });
    expect(brandUnknownFields(raw)).toEqual(["brand.appname", "brand.theme.secondary"]);
  });

  it("is empty for a brand with known fields only, or no brand, or one that does not parse", () => {
    expect(brandUnknownFields(JSON.stringify({ appName: "GAS", theme: { primary: "#000" } }))).toEqual([]);
    expect(brandUnknownFields(undefined)).toEqual([]);
    expect(brandUnknownFields("{not json")).toEqual([]);
  });
});

describe("docs/brand.example.json", () => {
  const raw = readFileSync("docs/brand.example.json", "utf8");

  it("parses, and names every field the app reads, no other", () => {
    const b = parseBrandConfig(raw);
    expect(brandUnknownFields(raw)).toEqual([]);
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(Object.keys(DEFAULT_BRAND).sort());
    expect(Object.keys(b.theme).sort()).toEqual(
      ["accent", "accentLight", "background", "frame", "primary", "primaryLight"],
    );
    expect(brandContrastWarnings(b.theme)).toEqual([]);
  });
});

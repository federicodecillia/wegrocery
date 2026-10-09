import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND } from "./default";
import {
  checkLogo,
  LOGO_MAX_BYTES,
  logoPath,
  mergeIdentity,
  mergeOverrides,
  parseLogoFile,
  readStoredOverrides,
  validateIdentityInput,
} from "./identity";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("validateIdentityInput", () => {
  it("keeps set fields and drops empty optional texts", () => {
    const r = validateIdentityInput({ appName: " GAS Riva ", shortName: "Riva", description: "", orgName: "" });
    expect(r).toEqual({ value: { appName: "GAS Riva", shortName: "Riva" } });
  });

  it("requires a name and a short name when sent", () => {
    expect(validateIdentityInput({ appName: "" })).toEqual({ error: "appNameRequired" });
    expect(validateIdentityInput({ shortName: "  " })).toEqual({ error: "shortNameRequired" });
  });

  it("limits lengths", () => {
    expect(validateIdentityInput({ shortName: "x".repeat(21) })).toEqual({ error: "tooLong" });
  });

  it("checks emails and lowercases them", () => {
    expect(validateIdentityInput({ supportEmail: "nope" })).toEqual({ error: "email" });
    expect(validateIdentityInput({ supportEmail: "Info@GAS.org" })).toEqual({ value: { supportEmail: "info@gas.org" } });
  });

  it("stores null for a cleared optional link or archive address", () => {
    expect(validateIdentityInput({ privacyUrl: "", archiveCcEmail: "" })).toEqual({
      value: { privacyUrl: null, archiveCcEmail: null },
    });
  });

  it("accepts only absolute http(s) links", () => {
    expect(validateIdentityInput({ privacyUrl: "javascript:alert(1)" })).toEqual({ error: "url" });
    expect(validateIdentityInput({ membershipUrl: "/tessera" })).toEqual({ error: "url" });
    expect(validateIdentityInput({ privacyUrl: "https://gas.org/privacy" })).toEqual({
      value: { privacyUrl: "https://gas.org/privacy" },
    });
  });

  it("checks colours and drops empty ones", () => {
    expect(validateIdentityInput({ theme: { primary: "red" } })).toEqual({ error: "color" });
    expect(validateIdentityInput({ theme: { primary: "#237032", accent: "" } })).toEqual({
      value: { theme: { primary: "#237032" } },
    });
  });

  it("refuses wrong types", () => {
    expect(validateIdentityInput(null)).toEqual({ error: "invalid" });
    expect(validateIdentityInput({ headerShowName: "yes" })).toEqual({ error: "invalid" });
    expect(validateIdentityInput({ appName: 3 })).toEqual({ error: "invalid" });
  });
});

describe("mergeOverrides", () => {
  it("keeps what another step saved and replaces the whole theme", () => {
    const stored = { appName: "A", theme: { primary: "#111111", accent: "#222222" } };
    expect(mergeOverrides(stored, { supportEmail: "a@b.it" })).toEqual({ ...stored, supportEmail: "a@b.it" });
    expect(mergeOverrides(stored, { theme: { primary: "#333333" } }).theme).toEqual({ primary: "#333333" });
  });
});

describe("readStoredOverrides", () => {
  it("keeps the valid fields of a damaged row", () => {
    expect(readStoredOverrides({ appName: "Ok", privacyUrl: "javascript:x", extra: 1 })).toEqual({ appName: "Ok" });
    expect(readStoredOverrides("nope")).toEqual({});
  });
});

describe("mergeIdentity", () => {
  it("lays overrides and the logo over the brand JSON", () => {
    const base = { ...DEFAULT_BRAND, theme: { primary: "#000000", accent: "#00a896" } };
    const merged = mergeIdentity(base, { appName: "Riva", theme: { primary: "#237032" } }, {
      type: "image/png",
      updatedAt: new Date(1_700_000_000_000),
    });
    expect(merged.appName).toBe("Riva");
    expect(merged.locale).toBe(base.locale);
    expect(merged.theme).toEqual({ primary: "#237032", accent: "#00a896" });
    expect(merged.logoUrl).toBe("/brand/logo-1700000000000.png");
  });

  it("is the brand JSON when nothing is stored", () => {
    expect(mergeIdentity(DEFAULT_BRAND, {}, null)).toEqual(DEFAULT_BRAND);
  });
});

describe("logo", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(checkLogo(PNG)).toEqual({ type: "image/png" });
    expect(checkLogo(JPEG)).toEqual({ type: "image/jpeg" });
    expect(checkLogo(WEBP)).toEqual({ type: "image/webp" });
  });

  it("refuses SVG, empty and oversized files", () => {
    expect(checkLogo(SVG)).toEqual({ error: "logoType" });
    expect(checkLogo(new Uint8Array())).toEqual({ error: "logoEmpty" });
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(PNG);
    expect(checkLogo(big)).toEqual({ error: "logoTooBig" });
  });

  it("round-trips the served file name", () => {
    const path = logoPath({ type: "image/webp", updatedAt: new Date(42) });
    expect(path).toBe("/brand/logo-42.webp");
    expect(parseLogoFile("logo-42.webp")).toEqual({ version: 42 });
    expect(parseLogoFile("logo-42.svg")).toBeNull();
    expect(parseLogoFile("../logo-1.png")).toBeNull();
  });
});

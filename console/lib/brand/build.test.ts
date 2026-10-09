import { describe, expect, it } from "vitest";
import { brandErrors, brandJsonString, buildBrandJson, isValidTimeZone } from "./build";

const base = { appName: "GAS Riva", shortName: "Riva", locale: "it" as const, currency: "EUR" };

describe("buildBrandJson", () => {
  it("keeps the minimal fields", () => {
    expect(buildBrandJson(base)).toEqual({
      appName: "GAS Riva",
      shortName: "Riva",
      orgName: "GAS Riva",
      locale: "it",
      currency: "EUR",
    });
  });

  it("adds colours with soft variants, logo and contact", () => {
    const b = buildBrandJson({ ...base, primary: "#237032", accent: "#1971C2", logoUrl: "https://x.example/logo.png", supportEmail: "a@x.example" });
    expect(b.theme?.primary).toBe("#237032");
    expect(b.theme?.accent).toBe("#1971c2");
    expect(b.theme?.primaryLight).toMatch(/^#[0-9a-f]{6}$/);
    expect(b.logoUrl).toBe("https://x.example/logo.png");
    expect(b.supportEmail).toBe("a@x.example");
  });

  it("is one line of valid JSON", () => {
    const s = brandJsonString(base);
    expect(s).not.toContain("\n");
    expect(JSON.parse(s).appName).toBe("GAS Riva");
  });
});

describe("brandErrors", () => {
  it("passes a good input", () => {
    expect(brandErrors(base)).toEqual([]);
  });
  it("flags each problem", () => {
    const errors = brandErrors({ ...base, appName: "", shortName: "A very long short name", currency: "eur", primary: "green", logoUrl: "http://x" });
    expect(errors).toHaveLength(5);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Europe/Rome")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

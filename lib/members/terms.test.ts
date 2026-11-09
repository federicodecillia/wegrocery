import { describe, expect, it } from "vitest";
import { mustAcceptTerms, newTermsVersion, termsHaveLink } from "./terms";

const links = { privacyUrl: "https://gas.example/privacy", termsUrl: null };
const on = { termsRequired: true, termsVersion: "2026-11-07T12:00:00.000Z" };

describe("terms acceptance", () => {
  it("asks nobody while the switch is off", () => {
    expect(mustAcceptTerms({ termsRequired: false, termsVersion: on.termsVersion }, links, null)).toBe(false);
  });

  it("asks whoever has not accepted the current version", () => {
    expect(mustAcceptTerms(on, links, null)).toBe(true);
    expect(mustAcceptTerms(on, links, "2026-10-01T08:00:00.000Z")).toBe(true);
    expect(mustAcceptTerms(on, links, on.termsVersion)).toBe(false);
  });

  it("stops asking without a version or without links", () => {
    expect(mustAcceptTerms({ termsRequired: true, termsVersion: null }, links, null)).toBe(false);
    expect(mustAcceptTerms(on, { privacyUrl: null, termsUrl: null }, null)).toBe(false);
  });

  it("needs one link of the two", () => {
    expect(termsHaveLink({ privacyUrl: null, termsUrl: "https://gas.example/termini" })).toBe(true);
    expect(termsHaveLink({ privacyUrl: "", termsUrl: null })).toBe(false);
  });

  it("dates a new version", () => {
    expect(newTermsVersion(new Date("2026-11-07T12:00:00Z"))).toBe("2026-11-07T12:00:00.000Z");
  });
});

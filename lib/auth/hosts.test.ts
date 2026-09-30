import { describe, expect, it } from "vitest";
import { allowedHosts, fallbackBaseURL, safeCallbackPath } from "./hosts";

describe("allowedHosts", () => {
  it("takes the production address from APP_BASE_URL and Vercel", () => {
    expect(
      allowedHosts({ VERCEL_ENV: "production", APP_BASE_URL: "https://gas.example.org", VERCEL_PROJECT_PRODUCTION_URL: "gas.vercel.app" }),
    ).toEqual(["gas.example.org", "gas.vercel.app"]);
  });

  it("adds only the preview's own URLs on a preview, never localhost", () => {
    expect(
      allowedHosts({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "gas.vercel.app",
        VERCEL_URL: "gas-abc123.vercel.app",
        VERCEL_BRANCH_URL: "gas-git-staging.vercel.app",
      }),
    ).toEqual(["gas.vercel.app", "gas-abc123.vercel.app", "gas-git-staging.vercel.app"]);
  });

  it("allows localhost under next dev only, whatever VERCEL_ENV a pulled env file carries", () => {
    expect(allowedHosts({})).toEqual(["localhost:3000"]);
    expect(allowedHosts({ NODE_ENV: "development", VERCEL_ENV: "production" })).toEqual(["localhost:3000"]);
    expect(allowedHosts({ NODE_ENV: "production", VERCEL_ENV: "production" })).toEqual([]);
    expect(allowedHosts({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" })).toEqual(["x.vercel.app"]);
  });

  it("ignores a malformed address", () => {
    expect(allowedHosts({ VERCEL_ENV: "production", APP_BASE_URL: "not a url" })).toEqual([]);
  });
});

describe("fallbackBaseURL", () => {
  it("prefers the production address", () => {
    expect(fallbackBaseURL({ VERCEL_ENV: "production", APP_BASE_URL: "https://gas.example.org" })).toBe("https://gas.example.org");
    expect(fallbackBaseURL({})).toBe("http://localhost:3000");
  });
});

describe("safeCallbackPath", () => {
  it("keeps a local path and refuses anything else", () => {
    expect(safeCallbackPath("/ordine?cycleId=1")).toBe("/ordine?cycleId=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "ordine", "", null, undefined]) {
      expect(safeCallbackPath(bad)).toBe("/");
    }
  });
});

import { describe, expect, it } from "vitest";
import { compareVersions, isBehind, newestVersion } from "./version";

describe("versions", () => {
  it("compares numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
  });
  it("finds the newest", () => {
    expect(newestVersion(["1.25.0", "v1.26.0", null, "garbage", "1.3.0"])).toBe("1.26.0");
    expect(newestVersion([])).toBeNull();
  });
  it("flags instances behind", () => {
    expect(isBehind("1.25.0", "1.26.0")).toBe(true);
    expect(isBehind("1.26.0", "1.26.0")).toBe(false);
    expect(isBehind(null, "1.26.0")).toBe(false);
  });
});

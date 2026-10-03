import { describe, expect, it } from "vitest";
import { fallbackInitial, findIcon, iconPath, localLogoPath, logoMimeType, MANIFEST_ICONS } from "./icons";

describe("pwa icons", () => {
  it("lists the sizes the browsers ask for, with a maskable one", () => {
    expect(MANIFEST_ICONS.map((i) => `${i.size}:${i.purpose}`)).toEqual(["192:any", "512:any", "512:maskable"]);
    expect(MANIFEST_ICONS.every((i) => iconPath(i).endsWith(".png"))).toBe(true);
    expect(findIcon("apple-180.png")?.size).toBe(180);
    expect(findIcon("nope.png")).toBeNull();
  });

  it("keeps the maskable logo inside the safe zone", () => {
    expect(findIcon("maskable-512.png")!.logoScale).toBeLessThanOrEqual(0.8 / Math.SQRT2);
  });

  it("reads a logo under public/ from disk and fetches any other", () => {
    expect(localLogoPath("/logo.png?v=2")).toBe("/logo.png");
    expect(localLogoPath("https://example.org/logo.png")).toBeNull();
    expect(localLogoPath("//cdn.example.org/logo.png")).toBeNull();
    expect(localLogoPath("/../secret")).toBeNull();
    expect(logoMimeType("/brand/logo.SVG")).toBe("image/svg+xml");
    expect(logoMimeType("/logo")).toBe("image/png");
  });

  it("draws a letter when the logo is missing", () => {
    expect(fallbackInitial("porta moneta")).toBe("P");
    expect(fallbackInitial(" ")).toBe("?");
  });
});

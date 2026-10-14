import { describe, expect, it } from "vitest";
import { isTheme, parseTheme, THEMES } from "./theme";

describe("theme", () => {
  it("knows its three choices", () => {
    expect(THEMES).toEqual(["system", "light", "dark"]);
    expect(THEMES.every(isTheme)).toBe(true);
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it("follows the device unless the cookie forces a theme", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("<script>")).toBe("system");
  });
});

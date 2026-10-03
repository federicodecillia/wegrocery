import { describe, expect, it } from "vitest";
import { installHint, type InstallContext } from "./install-hint";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const ctx = (c: Partial<InstallContext>): InstallContext => ({
  userAgent: ANDROID,
  maxTouchPoints: 5,
  standalone: false,
  dismissed: false,
  canPrompt: false,
  ...c,
});

describe("installHint", () => {
  it("offers the browser's dialog on Android when it is available", () => {
    expect(installHint(ctx({ canPrompt: true }))).toBe("prompt");
    expect(installHint(ctx({}))).toBeNull();
  });

  it("explains the share sheet on iPhone and iPad", () => {
    expect(installHint(ctx({ userAgent: IPHONE }))).toBe("ios");
    expect(installHint(ctx({ userAgent: IPAD, maxTouchPoints: 5 }))).toBe("ios");
  });

  it("stays quiet on a computer, once installed, and once dismissed", () => {
    expect(installHint(ctx({ userAgent: DESKTOP, maxTouchPoints: 0, canPrompt: true }))).toBeNull();
    expect(installHint(ctx({ userAgent: IPAD, maxTouchPoints: 0 }))).toBeNull();
    expect(installHint(ctx({ userAgent: IPHONE, standalone: true }))).toBeNull();
    expect(installHint(ctx({ canPrompt: true, dismissed: true }))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { formatBytes, formatNumber } from "./utils";

describe("formatters", () => {
  it("formats bytes", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(30 * 1024 * 1024)).toBe("30 MB");
  });
  it("formats numbers", () => {
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(0)).toBe("0");
  });
});

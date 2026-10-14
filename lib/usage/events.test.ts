import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { it as italian } from "@/lib/i18n/it";
import { isUsageEvent, USAGE_EVENTS } from "./events";

describe("usage events", () => {
  it("has a fixed list of names, none of them about a person", () => {
    expect(new Set(USAGE_EVENTS).size).toBe(USAGE_EVENTS.length);
    for (const name of USAGE_EVENTS) expect(name).toMatch(/^[a-z_]+$/);
    expect(isUsageEvent("login")).toBe(true);
    expect(isUsageEvent("mem_123")).toBe(false);
  });

  it("is named for the admin in Italian and English", () => {
    for (const strings of [italian, en]) {
      for (const name of USAGE_EVENTS) expect(strings.admin.stats.usageEvents[name], name).toBeTruthy();
    }
  });
});

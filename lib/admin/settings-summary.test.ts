import { describe, expect, it } from "vitest";
import type { ConfigItem } from "@/lib/config-status";
import { configBlocking, configIssues, ibanTail, stripeSummary } from "./settings-summary";

const item = (status: ConfigItem["status"], required = false): ConfigItem => ({ id: "email", status, required, vars: [] });

describe("ibanTail", () => {
  it("keeps the last four characters, without spaces", () => {
    expect(ibanTail("IT60 X054 2811 1010 0000 0123 456")).toBe("3456");
    expect(ibanTail("it60x0542811101000000123abc")).toBe("3ABC");
  });

  it("is null without an IBAN", () => {
    expect(ibanTail(null)).toBeNull();
    expect(ibanTail("")).toBeNull();
    expect(ibanTail(" 12 ")).toBeNull();
  });
});

describe("configIssues and configBlocking", () => {
  it("counts warnings and missing required items, not optional ones turned off", () => {
    const items = [item("ok", true), item("off"), item("missing"), item("warning"), item("missing", true)];
    expect(configIssues(items)).toBe(2);
    expect(configBlocking(items)).toBe(true);
  });

  it("is quiet when everything required is there", () => {
    const items = [item("ok", true), item("off"), item("missing")];
    expect(configIssues(items)).toBe(0);
    expect(configBlocking(items)).toBe(false);
  });
});

describe("stripeSummary", () => {
  it("tells apart not connected, to check and connected", () => {
    expect(stripeSummary({ source: "none", unreadable: false, usable: false })).toEqual({ state: "none", attention: false });
    expect(stripeSummary({ source: "app", unreadable: true, usable: false })).toEqual({ state: "check", attention: true });
    expect(stripeSummary({ source: "env", unreadable: false, usable: false })).toEqual({ state: "check", attention: true });
    expect(stripeSummary({ source: "app", unreadable: false, usable: true })).toEqual({ state: "connected", attention: false });
  });
});

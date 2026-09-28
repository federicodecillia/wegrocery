import { afterEach, describe, it as test, expect } from "vitest";
import {
  APP_TIME_ZONE,
  formatMoney,
  formatDate,
  formatDateTime,
  formatTime,
  resolveTimeZone,
} from "./format";

// default brand (no env in vitest) is locale "en", currency EUR
describe("format helpers with default (en) brand", () => {
  test("formatMoney renders EUR with en-GB conventions", () => {
    expect(formatMoney(1234.5)).toBe("€1,234.50");
  });
  test("formatMoney accepts numeric strings (Drizzle numeric columns)", () => {
    expect(formatMoney("90.00")).toBe("€90.00");
  });
  test("formatDate renders a readable date", () => {
    expect(formatDate(new Date("2026-06-11T10:00:00Z"))).toMatch(/11/);
  });
  test("formatTime renders HH:mm", () => {
    expect(formatTime(new Date("2026-06-11T10:30:00Z"))).toMatch(/\d{2}:\d{2}/);
  });
});

// Vercel renders on a UTC server while members browse from Europe/Rome: every
// formatter must pin the app time zone, or SSR and hydration disagree.
describe("date formatters pin the app time zone", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  test.each(["UTC", "Europe/Rome", "America/New_York"])(
    "render Europe/Rome wall time under process TZ=%s",
    (processTz) => {
      process.env.TZ = processTz;
      expect(APP_TIME_ZONE).toBe("Europe/Rome");
      expect(formatTime("2026-10-03T20:00:00.000Z")).toBe("22:00");
      expect(formatDateTime("2026-10-03T20:00:00.000Z")).toMatch(/3 Oct.*22:00/);
      // 22:30Z on Oct 3 is already Oct 4 in Rome
      expect(formatDate("2026-10-03T22:30:00.000Z")).toMatch(/^4 Oct 2026$/);
      // winter time after the October switch
      expect(formatTime("2026-10-26T19:00:00.000Z")).toBe("20:00");
    },
  );
});

describe("resolveTimeZone", () => {
  test("defaults to Europe/Rome", () => {
    expect(resolveTimeZone(undefined)).toBe("Europe/Rome");
    expect(resolveTimeZone("")).toBe("Europe/Rome");
  });
  test("accepts a valid IANA zone", () => {
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });
  test("falls back to Europe/Rome on an invalid zone instead of crashing Intl", () => {
    expect(resolveTimeZone("Mars/Olympus")).toBe("Europe/Rome");
  });
});

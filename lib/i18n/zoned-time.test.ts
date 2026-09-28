import { afterEach, describe, it as test, expect } from "vitest";
import { zonedLocalToUtc, utcToZonedLocalInput } from "./zoned-time";

// These helpers must not depend on the process time zone: Vercel runs in UTC,
// admins' browsers run in Europe/Rome. Every suite below runs under several
// process TZ values to prove it.
const PROCESS_ZONES = ["UTC", "Europe/Rome", "America/New_York"];
const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe.each(PROCESS_ZONES)("zonedLocalToUtc (process TZ=%s)", (processTz) => {
  test("interprets a naive wall time as Europe/Rome", () => {
    process.env.TZ = processTz;
    // Summer time (CEST, UTC+2)
    expect(iso(zonedLocalToUtc("2026-10-03T22:00"))).toBe("2026-10-03T20:00:00.000Z");
    // Winter time (CET, UTC+1)
    expect(iso(zonedLocalToUtc("2026-12-10T20:00"))).toBe("2026-12-10T19:00:00.000Z");
    // Seconds are accepted
    expect(iso(zonedLocalToUtc("2026-12-10T20:00:30"))).toBe("2026-12-10T19:00:30.000Z");
  });

  test("handles the October fall-back day (2026-10-25)", () => {
    process.env.TZ = processTz;
    expect(iso(zonedLocalToUtc("2026-10-25T01:30"))).toBe("2026-10-24T23:30:00.000Z");
    // 02:30 happens twice: pick the earlier instant (still CEST)
    expect(iso(zonedLocalToUtc("2026-10-25T02:30"))).toBe("2026-10-25T00:30:00.000Z");
    expect(iso(zonedLocalToUtc("2026-10-25T03:30"))).toBe("2026-10-25T02:30:00.000Z");
    expect(iso(zonedLocalToUtc("2026-10-25T20:00"))).toBe("2026-10-25T19:00:00.000Z");
  });

  test("handles the March spring-forward day (2026-03-29)", () => {
    process.env.TZ = processTz;
    expect(iso(zonedLocalToUtc("2026-03-29T01:30"))).toBe("2026-03-29T00:30:00.000Z");
    // 02:30 does not exist: shift forward to 03:30 CEST
    expect(iso(zonedLocalToUtc("2026-03-29T02:30"))).toBe("2026-03-29T01:30:00.000Z");
    expect(iso(zonedLocalToUtc("2026-03-29T03:00"))).toBe("2026-03-29T01:00:00.000Z");
  });

  test("passes through strings that already carry an offset", () => {
    process.env.TZ = processTz;
    expect(iso(zonedLocalToUtc("2026-10-03T22:00:00+02:00"))).toBe("2026-10-03T20:00:00.000Z");
    expect(iso(zonedLocalToUtc("2026-10-03T20:00:00.000Z"))).toBe("2026-10-03T20:00:00.000Z");
  });

  test("accepts an explicit zone", () => {
    process.env.TZ = processTz;
    expect(iso(zonedLocalToUtc("2026-10-03T22:00", "UTC"))).toBe("2026-10-03T22:00:00.000Z");
    expect(iso(zonedLocalToUtc("2026-10-03T22:00", "America/New_York"))).toBe(
      "2026-10-04T02:00:00.000Z",
    );
  });

  test("returns null for empty or invalid input", () => {
    process.env.TZ = processTz;
    expect(zonedLocalToUtc("")).toBeNull();
    expect(zonedLocalToUtc("abc")).toBeNull();
    expect(zonedLocalToUtc("2026-13-01T10:00")).toBeNull();
    expect(zonedLocalToUtc("2026-02-30T10:00")).toBeNull();
    expect(zonedLocalToUtc("2026-10-03T25:00")).toBeNull();
    expect(zonedLocalToUtc("2026-10-03")).toBeNull();
  });
});

describe.each(PROCESS_ZONES)("utcToZonedLocalInput (process TZ=%s)", (processTz) => {
  test("renders an instant as a Europe/Rome datetime-local value", () => {
    process.env.TZ = processTz;
    expect(utcToZonedLocalInput("2026-10-03T20:00:00.000Z")).toBe("2026-10-03T22:00");
    expect(utcToZonedLocalInput(new Date("2026-12-10T19:00:00.000Z"))).toBe("2026-12-10T20:00");
    // Crosses midnight: 22:30Z on Oct 3 is Oct 4 in Rome
    expect(utcToZonedLocalInput("2026-10-03T22:30:00.000Z")).toBe("2026-10-04T00:30");
  });

  test("handles both instants of the repeated hour on 2026-10-25", () => {
    process.env.TZ = processTz;
    expect(utcToZonedLocalInput("2026-10-25T00:30:00.000Z")).toBe("2026-10-25T02:30");
    expect(utcToZonedLocalInput("2026-10-25T01:30:00.000Z")).toBe("2026-10-25T02:30");
  });

  test("renders midnight as 00:00, never 24:00", () => {
    process.env.TZ = processTz;
    expect(utcToZonedLocalInput("2026-10-02T22:00:00.000Z")).toBe("2026-10-03T00:00");
  });

  test("returns an empty string for null, undefined or invalid input", () => {
    process.env.TZ = processTz;
    expect(utcToZonedLocalInput(null)).toBe("");
    expect(utcToZonedLocalInput(undefined)).toBe("");
    expect(utcToZonedLocalInput("not a date")).toBe("");
  });
});

describe("round trip", () => {
  test("every 15 minutes across both 2026 DST days maps back to the same wall time", () => {
    for (const day of ["2026-03-29", "2026-10-25", "2026-10-26"]) {
      for (let m = 0; m < 24 * 60; m += 15) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const local = `${day}T${hh}:${mm}`;
        // 02:xx on the spring-forward day does not exist on the wall clock
        if (day === "2026-03-29" && hh === "02") continue;
        expect(utcToZonedLocalInput(zonedLocalToUtc(local))).toBe(local);
      }
    }
  });
});

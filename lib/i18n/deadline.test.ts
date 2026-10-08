import { describe, expect, test } from "vitest";
import { closesIn, formatDeadline, formatPickupSlot, formatPickups, isLastDay } from "./deadline";

// Rome is UTC+2 until the last Sunday of October 2026.
const MONDAY_MIDNIGHT = "2026-10-12T22:00:00.000Z"; // Tue 13 Oct 00:00 in Rome
const now = new Date("2026-10-08T10:00:00.000Z");

describe("formatDeadline", () => {
  test("a close at 00:00 reads as 23:59 of the day before, with the weekday", () => {
    const s = formatDeadline(MONDAY_MIDNIGHT);
    expect(s).toMatch(/Mon/);
    expect(s).toMatch(/12 Oct/);
    expect(s).toMatch(/23:59/);
  });

  test("any other time is shown as stored", () => {
    const s = formatDeadline("2026-10-12T18:30:00.000Z"); // 20:30 in Rome
    expect(s).toMatch(/Mon.*12 Oct.*20:30/);
  });
});

describe("closesIn", () => {
  test("days, then hours, then minutes", () => {
    expect(closesIn(MONDAY_MIDNIGHT, now)).toBe("Closes in 4 days");
    expect(closesIn("2026-10-08T15:30:00.000Z", now)).toBe("Closes in 5 hours");
    expect(closesIn("2026-10-08T10:00:30.000Z", now)).toBe("Closes in 1 minute");
    expect(closesIn("2026-10-08T09:00:00.000Z", now)).toBe("Closing now");
  });

  test("the countdown shows only in the last day", () => {
    expect(isLastDay(MONDAY_MIDNIGHT, now)).toBe(false);
    expect(isLastDay("2026-10-08T20:00:00.000Z", now)).toBe(true);
    expect(isLastDay("2026-10-08T09:00:00.000Z", now)).toBe(false);
  });
});

describe("pickups", () => {
  test("a pickup at midnight has no time", () => {
    expect(formatPickupSlot("2026-10-14T22:00:00.000Z", null)).toMatch(/^Thu 15 Oct$/);
  });

  test("a pickup with hours shows the range", () => {
    expect(formatPickupSlot("2026-10-14T16:00:00.000Z", "20:00")).toMatch(/^Wed 14 Oct · 18:00–20:00$/);
  });

  test("two pickups with the same hours share one line", () => {
    const lines = formatPickups(
      { date: "2026-10-14T16:00:00.000Z", endTime: "20:00" },
      { date: "2026-10-15T16:00:00.000Z", endTime: "20:00" },
    );
    expect(lines).toEqual(["Wed 14 and Thu 15 Oct · 18:00–20:00"]);
  });

  test("two pickups with different hours keep a line each", () => {
    const lines = formatPickups(
      { date: "2026-10-14T16:00:00.000Z", endTime: "20:00" },
      { date: "2026-10-15T07:00:00.000Z", endTime: "11:00" },
    );
    expect(lines).toHaveLength(2);
  });
});

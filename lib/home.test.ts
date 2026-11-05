import { describe, expect, it } from "vitest";
import { buildCalendar, type CalendarCycleRow } from "./calendar";
import { COMING_UP_ON_HOME, daysFrom, deadlineDay, homeGroups, relativeDay } from "./home";

const NOW = new Date("2026-11-04T10:00:00Z");

function row(over: Partial<CalendarCycleRow>): CalendarCycleRow {
  return {
    cycleId: "c",
    title: "Ciclo",
    supplierName: null,
    status: "closed",
    orderOpenAt: new Date("2026-10-28T08:00:00Z"),
    orderCloseAt: new Date("2026-11-02T20:00:00Z"),
    createdAt: new Date("2026-10-28T08:00:00Z"),
    pickupDate: new Date("2026-11-06T16:00:00Z"),
    pickupEndTime: "19:00",
    pickup2Date: null,
    pickup2EndTime: null,
    productCount: 3,
    hasOrder: true,
    pickedUp: false,
    datesTentative: false,
    ...over,
  };
}

describe("homeGroups", () => {
  it("lists each cycle once: to collect by pickup, coming up by opening", () => {
    const entries = buildCalendar(
      [
        row({ cycleId: "later", pickupDate: new Date("2026-11-09T16:00:00Z") }),
        row({ cycleId: "sooner" }),
        row({ cycleId: "collected", pickedUp: true }),
        row({ cycleId: "not-mine", hasOrder: false }),
        row({ cycleId: "past", pickupDate: new Date("2026-11-03T16:00:00Z") }),
        row({ cycleId: "open", status: "open", orderCloseAt: new Date("2026-11-06T20:00:00Z") }),
        row({ cycleId: "plan-b", status: "planned", hasOrder: false, orderOpenAt: new Date("2026-11-20T08:00:00Z"), orderCloseAt: new Date("2026-11-27T20:00:00Z") }),
        row({ cycleId: "plan-a", status: "planned", hasOrder: false, orderOpenAt: new Date("2026-11-12T08:00:00Z"), orderCloseAt: new Date("2026-11-19T20:00:00Z") }),
      ],
      NOW,
    );
    const groups = homeGroups(entries);
    expect(groups.toCollect.map((e) => e.cycleId)).toEqual(["sooner", "later"]);
    expect(groups.comingUp.map((e) => e.cycleId)).toEqual(["plan-a", "plan-b"]);
  });

  it("keeps an open cycle past its deadline, with the member's order, among the ones to collect", () => {
    const entries = buildCalendar([row({ cycleId: "late", status: "open", orderCloseAt: new Date("2026-11-03T20:00:00Z") })], NOW);
    expect(homeGroups(entries).toCollect.map((e) => e.cycleId)).toEqual(["late"]);
  });

  it("shows at most a few planned cycles", () => {
    const planned = Array.from({ length: 5 }, (_, i) =>
      row({ cycleId: `p${i}`, status: "planned", hasOrder: false, orderOpenAt: new Date(`2026-11-1${i}T08:00:00Z`), orderCloseAt: new Date("2026-11-30T20:00:00Z") }),
    );
    expect(homeGroups(buildCalendar(planned, NOW)).comingUp).toHaveLength(COMING_UP_ON_HOME);
  });
});

describe("dates in words", () => {
  it("counts calendar days, not blocks of 24 hours", () => {
    expect(daysFrom("2026-11-04", "2026-11-04")).toBe(0);
    expect(daysFrom("2026-11-04", "2026-11-05")).toBe(1);
    expect(daysFrom("2026-10-24", "2026-10-26")).toBe(2); // across the clock change
    expect(daysFrom("2026-12-31", "2027-01-02")).toBe(2);
  });

  it("reads a midnight deadline as the end of the day before", () => {
    // 00:00 of 6 November in Rome (UTC+1).
    expect(deadlineDay(new Date("2026-11-05T23:00:00Z"))).toBe("2026-11-05");
    expect(deadlineDay(new Date("2026-11-06T20:00:00Z"))).toBe("2026-11-06");
  });

  it("says today, tomorrow or how many days are left", () => {
    expect(relativeDay(0)).toBe("today");
    expect(relativeDay(1)).toBe("tomorrow");
    expect(relativeDay(4)).toBe("4 days left");
  });
});

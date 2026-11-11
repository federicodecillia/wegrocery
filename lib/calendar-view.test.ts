import { describe, expect, it } from "vitest";
import { buildCalendar, type CalendarCycleRow } from "./calendar";
import { cyclesInMonth, cyclesOnDay, dayMarks, dayRole, defaultCycleId, spanOf, weekSegment } from "./calendar-view";

const NOW = new Date("2026-11-04T10:00:00Z");

function row(over: Partial<CalendarCycleRow>): CalendarCycleRow {
  return {
    cycleId: "c",
    title: "Ciclo",
    supplierName: null,
    status: "open",
    orderOpenAt: new Date("2026-11-02T08:00:00Z"),
    orderCloseAt: new Date("2026-11-08T20:00:00Z"),
    createdAt: new Date("2026-11-02T08:00:00Z"),
    pickupDate: new Date("2026-11-12T16:00:00Z"),
    pickupEndTime: "19:00",
    pickup2Date: null,
    pickup2EndTime: null,
    productCount: 3,
    hasOrder: false,
    pickedUp: false,
    datesTentative: false,
    ...over,
  };
}

const entry = (over: Partial<CalendarCycleRow>) => buildCalendar([row(over)], NOW)[0];

describe("spanOf and dayRole", () => {
  it("reads the window, the pickups and the whole span", () => {
    const span = spanOf(entry({}));
    expect(span).toEqual({ open: "2026-11-02", close: "2026-11-08", pickups: ["2026-11-12"], first: "2026-11-02", last: "2026-11-12" });
  });

  it("puts a midnight close on the day before", () => {
    // 00:00 of 9 November in Rome.
    expect(spanOf(entry({ orderCloseAt: new Date("2026-11-08T23:00:00Z") })).close).toBe("2026-11-08");
  });

  it("marks every day of the window, not only its ends", () => {
    const span = spanOf(entry({}));
    expect(dayRole(span, "2026-11-05")).toEqual({ window: true, opens: false, closes: false, pickup: false });
    expect(dayRole(span, "2026-11-08")).toMatchObject({ window: true, closes: true });
    expect(dayRole(span, "2026-11-10")).toEqual({ window: false, opens: false, closes: false, pickup: false });
    expect(dayRole(span, "2026-11-12").pickup).toBe(true);
  });
});

describe("dayMarks", () => {
  const entries = buildCalendar(
    [
      row({ cycleId: "a" }),
      row({ cycleId: "b", orderOpenAt: new Date("2026-11-08T08:00:00Z"), orderCloseAt: new Date("2026-11-09T23:00:00Z"), pickupDate: new Date("2026-11-08T16:00:00Z") }),
    ],
    NOW,
  );

  it("lists last days first, then pickups, then openings, one per cycle", () => {
    expect(dayMarks(entries, "2026-11-08")).toEqual(["closes", "pickup", "opens"]);
    expect(dayMarks(entries, "2026-11-02")).toEqual(["opens"]);
    expect(dayMarks(entries, "2026-11-05")).toEqual([]);
  });

  it("puts a midnight close on the day before, as the grid does", () => {
    // b closes at 00:00 of 10 November in Rome: its last day is the 9th.
    expect(dayMarks(entries, "2026-11-09")).toEqual(["closes"]);
    expect(dayMarks(entries, "2026-11-10")).toEqual([]);
  });
});

describe("the month's cycles", () => {
  const entries = buildCalendar(
    [
      // Opens in October, closes in December: it is November's too.
      row({ cycleId: "long", status: "open", orderOpenAt: new Date("2026-10-28T08:00:00Z"), orderCloseAt: new Date("2026-12-02T20:00:00Z"), pickupDate: new Date("2026-12-05T10:00:00Z") }),
      row({ cycleId: "open", orderCloseAt: new Date("2026-11-06T20:00:00Z") }),
      row({ cycleId: "collect", status: "closed", hasOrder: true, orderOpenAt: new Date("2026-10-20T08:00:00Z"), orderCloseAt: new Date("2026-10-27T20:00:00Z"), pickupDate: new Date("2026-11-05T16:00:00Z") }),
      row({ cycleId: "planned", status: "planned", orderOpenAt: new Date("2026-11-20T08:00:00Z"), orderCloseAt: new Date("2026-11-27T20:00:00Z"), pickupDate: new Date("2026-12-01T16:00:00Z") }),
      row({ cycleId: "october", status: "closed", orderOpenAt: new Date("2026-10-01T08:00:00Z"), orderCloseAt: new Date("2026-10-08T20:00:00Z"), pickupDate: new Date("2026-10-12T16:00:00Z") }),
    ],
    NOW,
  );

  it("are those whose span touches the month, by first day", () => {
    expect(cyclesInMonth(entries, "2026-11").map((e) => e.cycleId)).toEqual(["collect", "long", "open", "planned"]);
    expect(cyclesInMonth(entries, "2026-12").map((e) => e.cycleId)).toEqual(["long", "planned"]);
  });

  it("open the page on the cycle closing soonest, then the one to collect, then the planned one", () => {
    expect(defaultCycleId(entries, "2026-11")).toBe("open");
    expect(defaultCycleId(entries.filter((e) => e.state !== "open"), "2026-11")).toBe("collect");
    expect(defaultCycleId(entries.filter((e) => e.cycleId === "planned"), "2026-11")).toBe("planned");
    // In October the only open cycle touching it is the long one.
    expect(defaultCycleId(entries, "2026-10")).toBe("long");
    expect(defaultCycleId(entries, "2027-03")).toBeNull();
  });

  it("finds every cycle with something on a day, inside its window too", () => {
    expect(cyclesOnDay(entries, "2026-11-05").map((e) => e.cycleId).sort()).toEqual(["collect", "long", "open"]);
  });

});

describe("weekSegment", () => {
  const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

  it("cuts a span to the week and tells whether it starts or ends there", () => {
    expect(weekSegment(week, "2026-11-04", "2026-11-12")).toEqual({ start: 2, length: 5, startsHere: true, endsHere: false });
    expect(weekSegment(week, "2026-10-28", "2026-11-03")).toEqual({ start: 0, length: 2, startsHere: false, endsHere: true });
    expect(weekSegment(week, "2026-11-10", "2026-11-12")).toBeNull();
  });
});

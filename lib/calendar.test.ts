import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  dayOf,
  entriesIn,
  eventKindsByDay,
  monthGrid,
  monthRange,
  shiftMonth,
  type CalendarCycleRow,
} from "./calendar";

const NOW = new Date("2026-11-04T10:00:00Z");

function row(over: Partial<CalendarCycleRow> = {}): CalendarCycleRow {
  return {
    cycleId: "cyc_1",
    title: "Verdura",
    supplierName: "Orto",
    status: "closed",
    orderOpenAt: new Date("2026-10-20T08:00:00Z"),
    orderCloseAt: new Date("2026-10-27T20:00:00Z"),
    createdAt: new Date("2026-10-20T08:00:00Z"),
    pickupDate: new Date("2026-10-30T16:00:00Z"),
    pickupEndTime: "19:00",
    pickup2Date: null,
    pickup2EndTime: null,
    productCount: 12,
    hasOrder: false,
    pickedUp: false,
    datesTentative: false,
    ...over,
  };
}

describe("dayOf", () => {
  it("reads the day in the group's time zone", () => {
    // 23:30 UTC is 00:30 the next day in Rome.
    expect(dayOf(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
    expect(dayOf(new Date("2026-11-04T22:30:00Z"))).toBe("2026-11-04");
  });
});

describe("shiftMonth", () => {
  it("crosses the years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });
});

describe("monthGrid", () => {
  it("starts on Monday and pads with the months around", () => {
    // 1 November 2026 is a Sunday.
    const weeks = monthGrid("2026-11");
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toEqual({ day: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ day: "2026-11-01", inMonth: true });
    expect(weeks[5][6]).toEqual({ day: "2026-12-06", inMonth: false });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("has four weeks for a February that starts on Monday", () => {
    const weeks = monthGrid("2021-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].day).toBe("2021-02-01");
    expect(weeks[3][6].day).toBe("2021-02-28");
  });
});

describe("buildCalendar", () => {
  it("lists the events of a cycle in time order", () => {
    const [entry] = buildCalendar([row({ pickup2Date: new Date("2026-10-31T09:00:00Z") })], NOW);
    expect(entry.events.map((e) => [e.kind, e.day, e.second])).toEqual([
      ["opens", "2026-10-20", false],
      ["closes", "2026-10-27", false],
      ["pickup", "2026-10-30", false],
      ["pickup", "2026-10-31", true],
    ]);
    expect(entry.events[2].endTime).toBe("19:00");
  });

  it("opens at the creation when the cycle has no opening time", () => {
    const [entry] = buildCalendar([row({ orderOpenAt: null, createdAt: new Date("2026-10-19T08:00:00Z") })], NOW);
    expect(entry.events[0]).toMatchObject({ kind: "opens", day: "2026-10-19" });
  });

  it("tells open, closed and past cycles apart", () => {
    const state = (over: Partial<CalendarCycleRow>) => buildCalendar([row(over)], NOW)[0].state;
    expect(state({ status: "open", orderCloseAt: new Date("2026-11-06T20:00:00Z") })).toBe("open");
    expect(state({ status: "open", orderCloseAt: null })).toBe("open");
    // Past the deadline, still waiting for an admin to close it.
    expect(state({ status: "open", orderCloseAt: new Date("2026-11-03T20:00:00Z"), pickupDate: null })).toBe("closed");
    expect(state({ pickupDate: new Date("2026-11-04T16:00:00Z"), pickupEndTime: "19:00" })).toBe("closed");
    // Its pickup window ended at 19:00 Rome on 30 October.
    expect(state({})).toBe("past");
    expect(state({ pickupDate: null })).toBe("past");
    // The second pickup is still ahead.
    expect(state({ pickup2Date: new Date("2026-11-05T09:00:00Z") })).toBe("closed");
  });

  it("closes a pickup with no end time at midnight", () => {
    const state = buildCalendar([row({ pickupDate: new Date("2026-11-04T08:00:00Z"), pickupEndTime: null })], NOW)[0].state;
    expect(state).toBe("closed");
  });

  it("shows a planned cycle with its planned dates, its preview and no link", () => {
    const planned = row({
      status: "planned",
      orderOpenAt: new Date("2026-11-20T08:00:00Z"),
      orderCloseAt: new Date("2026-11-27T20:00:00Z"),
      pickupDate: new Date("2026-12-03T16:00:00Z"),
      datesTentative: true,
    });
    const preview = [{ name: "Mele", detail: "Fuji · 1 kg", price: 2.5, emoji: null }];
    const [entry] = buildCalendar([planned], NOW, new Map([["cyc_1", preview]]));
    expect(entry).toMatchObject({ state: "planned", tentative: true, preview, href: null });
    expect(entry.events.map((e) => [e.kind, e.day])).toEqual([
      ["opens", "2026-11-20"],
      ["closes", "2026-11-27"],
      ["pickup", "2026-12-03"],
    ]);
  });

  it("keeps the preview and the tentative flag for planned cycles only", () => {
    const [entry] = buildCalendar([row({ datesTentative: true })], NOW, new Map([["cyc_1", [{ name: "x", detail: null, price: 1, emoji: null }]]]));
    expect(entry.tentative).toBe(false);
    expect(entry.preview).toEqual([]);
  });

  it("leaves cancelled cycles out", () => {
    expect(buildCalendar([row({ status: "cancelled" })], NOW)).toEqual([]);
  });

  it("links an open cycle to the order and a past one, when ordered, to Storico", () => {
    const href = (over: Partial<CalendarCycleRow>) => buildCalendar([row(over)], NOW)[0].href;
    expect(href({ status: "open", orderCloseAt: null })).toBe("/ordine?cycleId=cyc_1");
    expect(href({ hasOrder: true })).toBe("/storico?cycleId=cyc_1");
    expect(href({})).toBeNull();
  });
});

describe("entriesIn", () => {
  const entries = buildCalendar(
    [
      row({ cycleId: "a", orderOpenAt: new Date("2026-11-10T08:00:00Z"), orderCloseAt: new Date("2026-11-17T20:00:00Z"), pickupDate: new Date("2026-12-02T16:00:00Z") }),
      row({ cycleId: "b", orderOpenAt: new Date("2026-10-28T08:00:00Z"), orderCloseAt: new Date("2026-11-03T20:00:00Z"), pickupDate: new Date("2026-11-05T16:00:00Z") }),
      row({ cycleId: "c" }),
    ],
    NOW,
  );

  it("keeps the cycles with an event in the month, by their first one there", () => {
    expect(entriesIn(entries, { month: "2026-11" }).map((e) => e.cycleId)).toEqual(["b", "a"]);
    expect(entriesIn(entries, { month: "2026-10" }).map((e) => e.cycleId)).toEqual(["c", "b"]);
  });

  it("keeps every event of a cycle, also those of other months", () => {
    const [b] = entriesIn(entries, { month: "2026-11" });
    expect(b.events).toHaveLength(3);
  });

  it("narrows to a day", () => {
    expect(entriesIn(entries, { month: "2026-11", day: "2026-11-05" }).map((e) => e.cycleId)).toEqual(["b"]);
    expect(entriesIn(entries, { month: "2026-11", day: "2026-11-06" })).toEqual([]);
  });

  it("marks the kinds of event of each day", () => {
    const kinds = eventKindsByDay(entries);
    expect([...(kinds.get("2026-11-05") ?? [])]).toEqual(["pickup"]);
    expect(kinds.has("2026-11-06")).toBe(false);
  });

  it("spans the months from the first event to the last, today and two months ahead included", () => {
    expect(monthRange(entries, "2026-11-04")).toEqual({ first: "2026-10", last: "2027-01" });
    expect(monthRange([], "2026-11-04")).toEqual({ first: "2026-11", last: "2027-01" });
    const far = buildCalendar([row({ cycleId: "far", pickupDate: new Date("2027-04-02T16:00:00Z") })], NOW);
    expect(monthRange(far, "2026-11-04").last).toBe("2027-04");
  });
});

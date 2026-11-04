import { describe, expect, it } from "vitest";
import { buildCycleIcs, type IcsText } from "./calendar-ics";

const TEXT: IcsText = {
  opens: (t) => `Opens: ${t}`,
  closes: (t) => `Last moment to order: ${t}`,
  pickup: (t) => `Pickup: ${t}`,
  closesAlarm: "Orders close soon",
};
const NOW = new Date("2026-11-04T10:00:00Z");

describe("buildCycleIcs", () => {
  const ics = buildCycleIcs(
    {
      cycleId: "cyc_1",
      title: "Verdura, frutta; e altro",
      supplierName: "Orto Bio",
      opensAt: null,
      closeAt: new Date("2026-11-08T20:00:00Z"),
      pickups: [
        { at: new Date("2026-11-12T16:00:00Z"), endTime: "19:00" },
        // 00:00 in Rome: a pickup day with no time.
        { at: new Date("2026-11-13T23:00:00Z"), endTime: null },
      ],
      url: "https://example.invalid/calendario",
    },
    TEXT,
    NOW,
  );
  const lines = ics.split("\r\n");

  it("is a calendar with one event per date, CRLF ended", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(3);
  });

  it("puts the last moment to order just before the close, with a reminder", () => {
    expect(lines).toContain("UID:cyc_1-closes@wegrocery");
    expect(lines).toContain("DTSTART:20261108T193000Z");
    expect(lines).toContain("DTEND:20261108T200000Z");
    expect(lines).toContain("TRIGGER:-PT180M");
  });

  it("gives a pickup its window, and a pickup with no time the whole day", () => {
    expect(lines).toContain("DTSTART:20261112T160000Z");
    // 19:00 in Rome is 18:00 UTC in November.
    expect(lines).toContain("DTEND:20261112T180000Z");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261114");
    expect(lines).toContain("DTEND;VALUE=DATE:20261115");
  });

  it("escapes the text and names the supplier", () => {
    expect(ics).toContain("SUMMARY:Pickup: Verdura\\, frutta\\; e altro (Orto Bio)");
  });

  it("adds the opening of a planned cycle", () => {
    const planned = buildCycleIcs(
      { cycleId: "p", title: "Formaggi", supplierName: null, opensAt: new Date("2026-11-16T08:00:00Z"), closeAt: null, pickups: [], url: null },
      TEXT,
      NOW,
    );
    expect(planned).toContain("UID:p-opens@wegrocery");
    expect(planned).toContain("SUMMARY:Opens: Formaggi");
    expect(planned).not.toContain("URL:");
  });
});

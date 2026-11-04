import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, icsFileName, icsHeaders } from "./ics";

const NOW = new Date("2026-11-04T10:00:00Z");
const PRODID = "-//FlyLabs//Esempio//IT";

describe("buildIcs", () => {
  const ics = buildIcs(
    [
      {
        uid: "c1-closes@app",
        summary: "Ultimo momento: Verdura, frutta; e altro",
        start: new Date("2026-11-08T19:30:00Z"),
        end: new Date("2026-11-08T20:00:00Z"),
        url: "https://app.example.org/calendario",
        alarm: { minutesBefore: 180, text: "Chiude tra poco" },
      },
      { uid: "c1-pickup@app", summary: "Ritiro", day: "2026-11-14", description: "Riga uno\nriga due" },
    ],
    { productId: PRODID, now: NOW },
  );
  const lines = ics.split("\r\n");

  it("is a calendar with one event each, CRLF ended", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain(`PRODID:${PRODID}`);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((l) => l === "DTSTAMP:20261104T100000Z")).toHaveLength(2);
  });

  it("writes a timed event in UTC, with its link and reminder", () => {
    expect(lines).toContain("UID:c1-closes@app");
    expect(lines).toContain("DTSTART:20261108T193000Z");
    expect(lines).toContain("DTEND:20261108T200000Z");
    expect(lines).toContain("URL:https://app.example.org/calendario");
    expect(lines).toContain("TRIGGER:-PT180M");
    expect(lines).toContain("DESCRIPTION:Chiude tra poco");
  });

  it("writes a whole day as dates, the end the day after", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20261114");
    expect(lines).toContain("DTEND;VALUE=DATE:20261115");
    expect(lines).toContain("DESCRIPTION:Riga uno\\nriga due");
  });

  it("closes a month and a year with the right next day", () => {
    const end = buildIcs([{ uid: "y", summary: "S", day: "2026-12-31" }], { productId: PRODID, now: NOW });
    expect(end).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("escapes the text", () => {
    expect(ics).toContain("SUMMARY:Ultimo momento: Verdura\\, frutta\\; e altro");
  });

  it("never ends an event before it starts", () => {
    const at = new Date("2026-11-12T16:00:00Z");
    const one = buildIcs([{ uid: "p", summary: "S", start: at, end: at }], { productId: PRODID, now: NOW });
    expect(one).toContain("DTEND:20261112T160100Z");
  });

  it("refuses a day that is not YYYY-MM-DD", () => {
    expect(() => buildIcs([{ uid: "x", summary: "S", day: "14/11/2026" }], { productId: PRODID, now: NOW })).toThrow();
  });
});

describe("text helpers", () => {
  it("escapes backslashes, separators and line breaks", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("folds long lines at 75 octets, multi-byte characters kept whole", () => {
    const folded = foldLine(`SUMMARY:${"è".repeat(60)}`);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"è".repeat(60)}`);
  });

  it("names the file after the title", () => {
    expect(icsFileName("Verdura di stagione!")).toBe("verdura-di-stagione.ics");
    expect(icsFileName("€€€", "ordine")).toBe("ordine.ics");
  });

  it("serves it as a private download", () => {
    expect(icsHeaders("a.ics")).toEqual({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="a.ics"',
      "Cache-Control": "private, no-store",
    });
  });
});

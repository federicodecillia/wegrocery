import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { parseCycleDates } from "./cycle-dates";

const iso = (d: Date | null | undefined) => (d instanceof Date ? d.toISOString() : d);

describe("parseCycleDates", () => {
  it("converts wall-clock inputs in the app zone", () => {
    const r = parseCycleDates({
      orderCloseAt: "2026-10-03T20:00",
      pickupDate: "2026-10-06T17:00",
      pickup2Date: "2026-10-07T00:00",
    });
    if ("error" in r) throw new Error(r.error);
    expect(iso(r.orderCloseAt)).toBe("2026-10-03T18:00:00.000Z");
    expect(iso(r.pickupDate)).toBe("2026-10-06T15:00:00.000Z");
    expect(iso(r.pickup2Date)).toBe("2026-10-06T22:00:00.000Z");
  });

  it("leaves absent keys undefined so a partial update does not touch them", () => {
    const r = parseCycleDates({});
    expect(r).toEqual({ orderCloseAt: undefined, pickupDate: undefined, pickup2Date: undefined });
  });

  it("maps an empty pickup to null (cleared) but requires the close date", () => {
    const r = parseCycleDates({ pickupDate: "", pickup2Date: "" });
    expect(r).toEqual({ orderCloseAt: undefined, pickupDate: null, pickup2Date: null });
    expect(parseCycleDates({ orderCloseAt: "" })).toEqual({
      error: t.errors.fieldRequired(t.fields.orderCloseDate),
    });
  });

  it("rejects a malformed date instead of silently clearing it", () => {
    expect(parseCycleDates({ orderCloseAt: "03/10/2026 20:00" })).toEqual({
      error: t.errors.invalidDate(t.fields.orderCloseDate),
    });
    expect(parseCycleDates({ pickupDate: "04/10/2026T17:00" })).toEqual({
      error: t.errors.invalidDate(t.fields.pickupDate),
    });
    expect(parseCycleDates({ pickup2Date: "2026-02-30T10:00" })).toEqual({
      error: t.errors.invalidDate(t.fields.pickupDate),
    });
  });
});

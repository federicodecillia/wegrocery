import { describe, expect, it } from "vitest";
import { pickupChange, pickupNotice, type CyclePickup } from "./pickup";

// Rome is UTC+2 until the last Sunday of October 2026.
const WED_18 = new Date("2026-10-14T16:00:00.000Z"); // Wed 14 Oct 18:00 in Rome
const THU_18 = new Date("2026-10-15T16:00:00.000Z"); // Thu 15 Oct 18:00 in Rome
const NONE: CyclePickup = { pickupDate: null, pickupEndTime: null, pickup2Date: null, pickup2EndTime: null };
const wed = (endTime: string | null = "20:00"): CyclePickup => ({ ...NONE, pickupDate: WED_18, pickupEndTime: endTime });

describe("pickupChange", () => {
  it("is null when nothing members read has changed", () => {
    expect(pickupChange(NONE, NONE)).toBeNull();
    expect(pickupChange(wed(), { ...wed(), pickupDate: new Date(WED_18.getTime()) })).toBeNull();
  });

  it("ignores a second pickup with no first one: it is never shown", () => {
    expect(pickupChange(NONE, { ...NONE, pickup2Date: THU_18 })).toBeNull();
  });

  it("tells a new pickup from a moved or a cleared one", () => {
    expect(pickupChange(NONE, wed())).toBe("added");
    expect(pickupChange(wed(), { ...wed(), pickupDate: THU_18 })).toBe("changed");
    expect(pickupChange(wed(), NONE)).toBe("removed");
  });

  it("counts a new end time and a second day as a change", () => {
    expect(pickupChange(wed("20:00"), wed("21:00"))).toBe("changed");
    expect(pickupChange(wed(), { ...wed(), pickup2Date: THU_18, pickup2EndTime: "20:00" })).toBe("changed");
  });
});

describe("pickupNotice", () => {
  it("names the cycle and the new pickup", () => {
    const notice = pickupNotice("Verdura", NONE, wed());
    expect(notice?.title).toContain("Verdura");
    expect(notice?.body).toContain("Wed 14 Oct · 18:00–20:00");
  });

  it("shows the new pickup and the old one when it moved", () => {
    const notice = pickupNotice("Verdura", wed(), { ...wed(), pickupDate: THU_18 });
    expect(notice?.body).toMatch(/Thu 15 Oct · 18:00–20:00.*Wed 14 Oct · 18:00–20:00/);
  });

  it("says when the pickup no longer has a date", () => {
    expect(pickupNotice("Verdura", wed(), NONE)?.body).toContain("Verdura");
  });

  it("is null when the pickup did not change", () => {
    expect(pickupNotice("Verdura", wed(), wed())).toBeNull();
  });
});

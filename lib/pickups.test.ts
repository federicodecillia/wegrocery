import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { PICKUP_COLLECTED_BY_MAX, PICKUP_NOTE_MAX, pickupProgressLabel, pickupRefusal, readPickupForm } from "./pickups";

// 12:00 in Rome (CEST) on 24 October 2026.
const now = new Date("2026-10-24T10:00:00Z");

describe("readPickupForm", () => {
  it("marks the pickup now when no time is typed", () => {
    expect(readPickupForm({}, now)).toEqual({ pickedUpAt: now, collectedBy: null, note: null });
    expect(readPickupForm({ pickedUpAt: "  ", collectedBy: " ", note: "\n" }, now)).toEqual({
      pickedUpAt: now,
      collectedBy: null,
      note: null,
    });
  });

  it("reads a typed time in the group's time zone", () => {
    const r = readPickupForm({ pickedUpAt: "2026-10-23T18:30" }, now);
    expect("error" in r ? null : r.pickedUpAt.toISOString()).toBe("2026-10-23T16:30:00.000Z");
  });

  it("refuses a time that does not exist or is ahead of now", () => {
    expect(readPickupForm({ pickedUpAt: "2026-02-30T10:00" }, now)).toHaveProperty("error");
    expect(readPickupForm({ pickedUpAt: "2026-10-24T13:00" }, now)).toHaveProperty("error");
    // A few minutes ahead (a clock slightly off) still passes.
    expect(readPickupForm({ pickedUpAt: "2026-10-24T12:05" }, now)).not.toHaveProperty("error");
  });

  it("tidies who collected, keeps the note's lines, and caps both", () => {
    expect(readPickupForm({ collectedBy: "  la   vicina ", note: " prima riga\nseconda " }, now)).toMatchObject({
      collectedBy: "la vicina",
      note: "prima riga\nseconda",
    });
    expect(readPickupForm({ collectedBy: "x".repeat(PICKUP_COLLECTED_BY_MAX + 1) }, now)).toHaveProperty("error");
    expect(readPickupForm({ note: "x".repeat(PICKUP_NOTE_MAX + 1) }, now)).toHaveProperty("error");
    expect(readPickupForm({ note: "x".repeat(PICKUP_NOTE_MAX) }, now)).not.toHaveProperty("error");
  });
});

describe("pickupRefusal", () => {
  it("takes pickups on a closed cycle only", () => {
    expect(pickupRefusal("closed")).toBeNull();
    expect(pickupRefusal("open")).toBe(t.admin.pickups.errors.cycleOpen);
    expect(pickupRefusal("cancelled")).toBe(t.admin.pickups.errors.cycleCancelled);
  });
});

describe("pickupProgressLabel", () => {
  it("counts the pickups, and says when everyone collected", () => {
    expect(pickupProgressLabel({ done: 8, total: 10 })).toBe(t.admin.pickups.progress(8, 10));
    expect(pickupProgressLabel({ done: 8, total: 10 })).toMatch(/^8\/10 /);
    expect(pickupProgressLabel({ done: 10, total: 10 })).toBe(t.admin.pickups.allCollected);
  });
});

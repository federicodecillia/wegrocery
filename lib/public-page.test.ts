import { describe, expect, it } from "vitest";
import { joinAction, pickPublicCycle, type PublicCycle } from "./public-page";

const now = new Date("2026-11-07T10:00:00Z");
const cycle = (id: string, over: Partial<PublicCycle>): PublicCycle => ({
  cycleId: id,
  title: id,
  status: "open",
  orderOpenAt: null,
  orderCloseAt: null,
  pickupDate: null,
  pickupEndTime: null,
  datesTentative: false,
  pickupTentative: false,
  ...over,
});

describe("pickPublicCycle", () => {
  it("shows the open cycle closing soonest before any planned one", () => {
    const picked = pickPublicCycle(
      [
        cycle("planned", { status: "planned", orderOpenAt: new Date("2026-11-08T08:00:00Z") }),
        cycle("late", { orderCloseAt: new Date("2026-11-12T20:00:00Z") }),
        cycle("soon", { orderCloseAt: new Date("2026-11-09T20:00:00Z") }),
      ],
      now,
    );
    expect(picked?.cycleId).toBe("soon");
  });
  it("else the planned cycle opening soonest, skipping one whose dates are past", () => {
    const picked = pickPublicCycle(
      [
        cycle("past", { status: "planned", orderOpenAt: new Date("2026-10-01T08:00:00Z"), pickupDate: new Date("2026-10-05T08:00:00Z") }),
        cycle("later", { status: "planned", orderOpenAt: new Date("2026-11-20T08:00:00Z") }),
        cycle("next", { status: "planned", orderOpenAt: new Date("2026-11-10T08:00:00Z") }),
      ],
      now,
    );
    expect(picked?.cycleId).toBe("next");
  });
  it("is null with nothing in view", () => {
    expect(pickPublicCycle([], now)).toBeNull();
  });
});

describe("joinAction", () => {
  it("follows the sign-up mode", () => {
    expect(joinAction("closed")).toBeNull();
    expect(joinAction("request")).toBe("request");
    expect(joinAction("open")).toBe("open");
  });
});

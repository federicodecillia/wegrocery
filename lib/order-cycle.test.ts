import { describe, expect, it } from "vitest";
import { resolveOrderCycle } from "./order-cycle";

const weekly = { cycleId: "cyc_weekly", title: "Settimana 40" };
const cheese = { cycleId: "cyc_cheese", title: "Formaggi" };

describe("resolveOrderCycle", () => {
  it("has nothing to open when no cycle is open for the member", () => {
    expect(resolveOrderCycle([], undefined)).toEqual({ kind: "none" });
    expect(resolveOrderCycle([], "cyc_weekly")).toEqual({ kind: "none" });
  });

  it("opens the requested cycle, not the first one", () => {
    expect(resolveOrderCycle([weekly, cheese], "cyc_cheese")).toEqual({
      kind: "open",
      cycle: cheese,
    });
  });

  it("opens the only open cycle when the link names none", () => {
    expect(resolveOrderCycle([weekly], undefined)).toEqual({ kind: "open", cycle: weekly });
    expect(resolveOrderCycle([weekly], "")).toEqual({ kind: "open", cycle: weekly });
  });

  it("lets the member choose when several cycles are open and the link names none", () => {
    expect(resolveOrderCycle([weekly, cheese], undefined)).toEqual({ kind: "choose" });
  });

  it("treats a closed or inaccessible cycleId like a missing one", () => {
    expect(resolveOrderCycle([weekly], "cyc_closed")).toEqual({ kind: "open", cycle: weekly });
    expect(resolveOrderCycle([weekly, cheese], "cyc_closed")).toEqual({ kind: "choose" });
  });
});

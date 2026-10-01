import { describe, expect, it } from "vitest";
import { modeChangeBlockers } from "./mode-change";

const clear = { currency: "EUR", stripeUsable: true, runningCycles: 0, unsettledCycles: 0 };

describe("what stops a change of payment mode", () => {
  it("lets a group with nothing running switch either way", () => {
    expect(modeChangeBlockers({ ...clear, target: "per_order" })).toEqual([]);
    expect(modeChangeBlockers({ ...clear, target: "wallet" })).toEqual([]);
  });

  it("waits for the running cycles and for the per_order cycles not settled, in both directions", () => {
    for (const target of ["per_order", "wallet"] as const) {
      expect(modeChangeBlockers({ ...clear, target, runningCycles: 1, unsettledCycles: 2 })).toEqual([
        "running_cycles",
        "unsettled_cycles",
      ]);
    }
  });

  it("offers pay-per-order only in euros and with a usable Stripe key", () => {
    expect(modeChangeBlockers({ ...clear, target: "per_order", currency: "CHF", stripeUsable: false })).toEqual([
      "currency",
      "stripe_unavailable",
    ]);
    expect(modeChangeBlockers({ ...clear, target: "wallet", currency: "CHF", stripeUsable: false })).toEqual([]);
  });
});

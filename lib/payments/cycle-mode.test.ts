import { describe, expect, it } from "vitest";
import { cardCyclesSelectable, resolveNewCycleMode } from "./cycle-mode";

const wallet = { groupMode: "wallet" as const, stripeUsable: true, currency: "EUR" };
const perOrder = { ...wallet, groupMode: "per_order" as const };

describe("the payment mode of a new cycle", () => {
  it("defaults to the group's mode", () => {
    expect(resolveNewCycleMode(undefined, wallet)).toEqual({ mode: "wallet" });
    expect(resolveNewCycleMode("", perOrder)).toEqual({ mode: "per_order" });
  });

  it("lets a wallet group pay one cycle by card with a usable key, in euros", () => {
    expect(cardCyclesSelectable(wallet)).toBe(true);
    expect(resolveNewCycleMode("per_order", wallet)).toEqual({ mode: "per_order" });
    expect(resolveNewCycleMode("wallet", wallet)).toEqual({ mode: "wallet" });
  });

  it("refuses a card cycle without a usable key or outside euros", () => {
    for (const ctx of [{ ...wallet, stripeUsable: false }, { ...wallet, currency: "CHF" }]) {
      expect(cardCyclesSelectable(ctx)).toBe(false);
      expect(resolveNewCycleMode("per_order", ctx)).toEqual({ error: "card_unavailable" });
    }
  });

  it("keeps every cycle of a pay-per-order group on the card", () => {
    expect(cardCyclesSelectable(perOrder)).toBe(false);
    expect(resolveNewCycleMode("per_order", perOrder)).toEqual({ mode: "per_order" });
    expect(resolveNewCycleMode("wallet", perOrder)).toEqual({ error: "invalid" });
  });

  it("rejects unknown values", () => {
    expect(resolveNewCycleMode("cash", wallet)).toEqual({ error: "invalid" });
  });
});

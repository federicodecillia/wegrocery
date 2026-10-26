import { describe, expect, it } from "vitest";
import { cardCyclesAvailable, cardCyclesSelectable, defaultNewCycleMode, resolveNewCycleMode } from "./cycle-mode";

const wallet = { groupMode: "wallet" as const, stripeUsable: true, currency: "EUR", cardCyclesEnabled: true };
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

  it("refuses a card cycle when the group switched card cycles off", () => {
    const off = { ...wallet, cardCyclesEnabled: false };
    expect(cardCyclesAvailable(off)).toBe(true);
    expect(cardCyclesSelectable(off)).toBe(false);
    expect(resolveNewCycleMode("per_order", off)).toEqual({ error: "card_unavailable" });
    expect(resolveNewCycleMode("wallet", off)).toEqual({ mode: "wallet" });
    expect(resolveNewCycleMode(undefined, off)).toEqual({ mode: "wallet" });
  });

  it("keeps every cycle of a pay-per-order group on the card, whatever the switch", () => {
    expect(resolveNewCycleMode("per_order", { ...perOrder, cardCyclesEnabled: false })).toEqual({ mode: "per_order" });
  });

  it("keeps every cycle of a pay-per-order group on the card", () => {
    expect(cardCyclesSelectable(perOrder)).toBe(false);
    expect(resolveNewCycleMode("per_order", perOrder)).toEqual({ mode: "per_order" });
    expect(resolveNewCycleMode("wallet", perOrder)).toEqual({ error: "invalid" });
  });

  it("rejects unknown values", () => {
    expect(resolveNewCycleMode("cash", wallet)).toEqual({ error: "invalid" });
  });

  it("starts new cycles by card when the group chose so, while card cycles are possible", () => {
    const cardFirst = { ...wallet, newCycleMode: "per_order" as const };
    expect(defaultNewCycleMode(cardFirst)).toBe("per_order");
    expect(resolveNewCycleMode(undefined, cardFirst)).toEqual({ mode: "per_order" });
    // The wallet stays one click away.
    expect(resolveNewCycleMode("wallet", cardFirst)).toEqual({ mode: "wallet" });
    // No usable key, or card cycles switched off: back to the wallet.
    expect(defaultNewCycleMode({ ...cardFirst, stripeUsable: false })).toBe("wallet");
    expect(defaultNewCycleMode({ ...cardFirst, cardCyclesEnabled: false })).toBe("wallet");
    expect(defaultNewCycleMode({ ...wallet, newCycleMode: null })).toBe("wallet");
  });
});

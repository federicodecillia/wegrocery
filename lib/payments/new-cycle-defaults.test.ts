import { describe, expect, it } from "vitest";
import {
  newCyclePaymentChoice,
  newCyclePaymentColumns,
  parseNewCycleDefaults,
  planNewCycleDefaults,
  startingFee,
  type ModeDefaultsInput,
} from "./new-cycle-defaults";

const card: ModeDefaultsInput = { shippingMode: "fixed_per_member", shippingAmount: "0", feeType: "percent", feeValue: "2" };

describe("the defaults of new cycles", () => {
  it("reads what was stored and drops what does not fit", () => {
    expect(parseNewCycleDefaults(null)).toEqual({});
    expect(parseNewCycleDefaults([])).toEqual({});
    expect(
      parseNewCycleDefaults({
        per_order: { shipping: { mode: "fixed_per_member", amount: 0 }, fee: { type: "percent", value: 2 } },
        wallet: { shipping: { mode: "proportional", amount: null }, fee: { type: "none" } },
        cash: { fee: { type: "percent", value: 2 } },
      }),
    ).toEqual({
      per_order: { shipping: { mode: "fixed_per_member", amount: 0 }, fee: { type: "percent", value: 2 } },
      wallet: { shipping: { mode: "proportional", amount: null }, fee: { type: "none" } },
    });
    // No fee for a card cycle, a fee over the maximum, a negative shipping.
    expect(
      parseNewCycleDefaults({
        per_order: { fee: { type: "none" } },
        wallet: { fee: { type: "percent", value: 99 }, shipping: { mode: "fixed_per_member", amount: -1 } },
      }),
    ).toEqual({});
  });

  it("stores what the form sent, mode by mode", () => {
    const plan = planNewCycleDefaults({ wallet: { fee: { type: "none" } } }, { per_order: card });
    expect(plan).toEqual({
      defaults: {
        wallet: { fee: { type: "none" } },
        per_order: { shipping: { mode: "fixed_per_member", amount: 0 }, fee: { type: "percent", value: 2 } },
      },
    });
  });

  it("takes decimals with a comma and leaves an empty fee unset", () => {
    const plan = planNewCycleDefaults({}, {
      wallet: { shippingMode: "proportional", shippingAmount: "12,50", feeType: "fixed", feeValue: "" },
    });
    expect(plan).toEqual({ defaults: { wallet: { shipping: { mode: "proportional", amount: 12.5 } } } });
    const empty = planNewCycleDefaults({}, { wallet: { ...card, shippingAmount: "" } });
    expect(empty).toEqual({
      defaults: { wallet: { shipping: { mode: "fixed_per_member", amount: null }, fee: { type: "percent", value: 2 } } },
    });
  });

  it("refuses a card cycle without a fee, a bad amount or a fee over the maximum", () => {
    expect(planNewCycleDefaults({}, { per_order: { ...card, feeType: "none" } })).toEqual({
      error: { mode: "per_order", field: "fee" },
    });
    expect(planNewCycleDefaults({}, { wallet: { ...card, shippingAmount: "-3" } })).toEqual({
      error: { mode: "wallet", field: "shipping" },
    });
    expect(planNewCycleDefaults({}, { wallet: { ...card, feeValue: "30" } })).toEqual({
      error: { mode: "wallet", field: "fee" },
    });
  });

  it("starts a cycle from the default fee, else the last one of that mode", () => {
    const last = { type: "percent" as const, value: 10 };
    expect(startingFee({ per_order: { fee: { type: "percent", value: 2 } } }, "per_order", last)).toEqual({
      type: "percent",
      value: 2,
    });
    expect(startingFee({ wallet: { fee: { type: "none" } } }, "wallet", last)).toBeNull();
    expect(startingFee({}, "wallet", last)).toEqual(last);
    expect(startingFee({}, "per_order", null)).toBeNull();
  });

  it("maps the three choices to the two columns and back", () => {
    for (const choice of ["wallet_only", "wallet_default", "card_default"] as const) {
      const c = newCyclePaymentColumns(choice);
      expect(newCyclePaymentChoice(c.cardCyclesEnabled, c.newCyclePaymentMode)).toBe(choice);
    }
    // Card cycles switched off win over a card default left behind.
    expect(newCyclePaymentChoice(false, "per_order")).toBe("wallet_only");
  });
});

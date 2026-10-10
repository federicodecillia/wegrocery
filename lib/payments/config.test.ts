import { describe, expect, it } from "vitest";
import {
  applyStripeKeyPolicy,
  parseTopupAmount,
  resolveStripeKey,
  topupBlockReason,
  topupCeilingCents,
  topupPresets,
} from "./config";

describe("parseTopupAmount", () => {
  it("accepts whole euros and both decimal separators", () => {
    expect(parseTopupAmount("50")).toEqual({ cents: 5000 });
    expect(parseTopupAmount("50,5")).toEqual({ cents: 5050 });
    expect(parseTopupAmount(" 20.05 ")).toEqual({ cents: 2005 });
  });

  it("enforces the range", () => {
    expect(parseTopupAmount("0.49")).toEqual({ error: "tooLow" });
    expect(parseTopupAmount("0,5")).toEqual({ cents: 50 });
    expect(parseTopupAmount("0")).toEqual({ error: "tooLow" });
    expect(parseTopupAmount("300")).toEqual({ cents: 30000 });
    expect(parseTopupAmount("300.01")).toEqual({ error: "tooHigh" });
  });

  it("rejects anything it would have to guess", () => {
    for (const bad of ["", "-50", "50.123", "1.000,00", "5e3", "abc", "50 €"]) {
      expect(parseTopupAmount(bad)).toEqual({ error: "invalid" });
    }
  });
});

describe("resolveStripeKey", () => {
  it("is disabled without a key", () => {
    expect(resolveStripeKey({})).toEqual({ enabled: false, reason: "missing" });
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "  " })).toEqual({ enabled: false, reason: "missing" });
  });

  it("allows test keys outside production and on the demo", () => {
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "sk_test_x", VERCEL_ENV: "preview" })).toMatchObject({
      enabled: true,
      livemode: false,
    });
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "sk_test_x" })).toMatchObject({ enabled: true });
    expect(
      resolveStripeKey({ STRIPE_SECRET_KEY: "sk_test_x", VERCEL_ENV: "production", DEMO_MODE: "true" }),
    ).toMatchObject({ enabled: true });
  });

  it("refuses a test key on a real production deploy", () => {
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "sk_test_x", VERCEL_ENV: "production" })).toEqual({
      enabled: false,
      reason: "testKeyInProduction",
    });
  });

  it("allows live keys only on a real production deploy", () => {
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "sk_live_x", VERCEL_ENV: "production" })).toMatchObject({
      enabled: true,
      livemode: true,
    });
    expect(resolveStripeKey({ STRIPE_SECRET_KEY: "rk_live_x", VERCEL_ENV: "preview" })).toEqual({
      enabled: false,
      reason: "liveKeyOutsideProduction",
    });
    expect(
      resolveStripeKey({ STRIPE_SECRET_KEY: "sk_live_x", VERCEL_ENV: "production", DEMO_MODE: "true" }),
    ).toEqual({ enabled: false, reason: "liveKeyOutsideProduction" });
  });
});

describe("applyStripeKeyPolicy", () => {
  // A key from the in-app connection follows the env key's rules, and ignores
  // any STRIPE_SECRET_KEY in the env it is given.
  it("applies the same mode rules to a key not from the env", () => {
    expect(applyStripeKeyPolicy("rk_test_x", { VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "sk_live_y" })).toEqual({
      enabled: true,
      secretKey: "rk_test_x",
      livemode: false,
    });
    expect(applyStripeKeyPolicy(" rk_live_x ", { VERCEL_ENV: "production" })).toEqual({
      enabled: true,
      secretKey: "rk_live_x",
      livemode: true,
    });
    expect(applyStripeKeyPolicy("rk_live_x", { VERCEL_ENV: "production", DEMO_MODE: "true" })).toEqual({
      enabled: false,
      reason: "liveKeyOutsideProduction",
    });
    expect(applyStripeKeyPolicy("sk_test_x", { VERCEL_ENV: "production" })).toEqual({
      enabled: false,
      reason: "testKeyInProduction",
    });
    expect(applyStripeKeyPolicy(null, {})).toEqual({ enabled: false, reason: "missing" });
  });
});

describe("topupCeilingCents", () => {
  it("is the usual maximum without a group maximum", () => {
    expect(topupCeilingCents(0, null)).toBe(30000);
    expect(topupCeilingCents(-5000, null)).toBe(30000);
  });

  it("keeps the balance within the group maximum", () => {
    expect(topupCeilingCents(10000, 30000)).toBe(20000);
    expect(topupCeilingCents(-2340, 0)).toBe(2340);
    expect(topupCeilingCents(0, 100000)).toBe(30000);
  });

  it("is null when not even Stripe's minimum fits", () => {
    expect(topupCeilingCents(29950, 30000)).toBe(50);
    expect(topupCeilingCents(29951, 30000)).toBeNull();
    expect(topupCeilingCents(0, 0)).toBeNull();
    expect(topupCeilingCents(500, 0)).toBeNull();
  });
});

describe("topupPresets", () => {
  it("offers the usual amounts that fit", () => {
    expect(topupPresets(0, 30000)).toEqual([
      { cents: 2500, settlesDebt: false },
      { cents: 5000, settlesDebt: false },
      { cents: 10000, settlesDebt: false },
    ]);
    expect(topupPresets(0, 6000).map((p) => p.cents)).toEqual([2500, 5000]);
    expect(topupPresets(0, 2000)).toEqual([]);
  });

  it("puts the exact debt first", () => {
    expect(topupPresets(-2340, 30000)[0]).toEqual({ cents: 2340, settlesDebt: true });
    expect(topupPresets(-2340, 2340)).toEqual([{ cents: 2340, settlesDebt: true }]);
  });

  it("raises a tiny debt to Stripe's minimum", () => {
    expect(topupPresets(-30, 30000)[0]).toEqual({ cents: 50, settlesDebt: true });
  });

  it("skips a debt the ceiling cannot cover, and a usual amount equal to the debt", () => {
    expect(topupPresets(-40000, 30000).some((p) => p.settlesDebt)).toBe(false);
    expect(topupPresets(-2500, 30000)).toEqual([
      { cents: 2500, settlesDebt: true },
      { cents: 5000, settlesDebt: false },
      { cents: 10000, settlesDebt: false },
    ]);
  });
});

describe("topupBlockReason", () => {
  it("is the maximum when the balance already reaches it", () => {
    expect(topupBlockReason(0, 0)).toBe("atMaximum");
    expect(topupBlockReason(500, 0)).toBe("atMaximum");
  });

  it("is Stripe's minimum when something still fits but less than 0,50 EUR", () => {
    expect(topupCeilingCents(-30, 0)).toBeNull();
    expect(topupBlockReason(-30, 0)).toBe("belowMinimum");
    expect(topupBlockReason(29951, 30000)).toBe("belowMinimum");
  });
});

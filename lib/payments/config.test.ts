import { describe, expect, it } from "vitest";
import { parseTopupAmount, resolveStripeKey } from "./config";

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

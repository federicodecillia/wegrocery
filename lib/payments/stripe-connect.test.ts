import { describe, expect, it } from "vitest";
import {
  accountLabelOf,
  checkPastedKey,
  classifyStripeError,
  disconnectBlockers,
  endpointsToReplace,
  webhookUrlFor,
} from "./stripe-connect";

const preview = { VERCEL_ENV: "preview" };
const production = { VERCEL_ENV: "production" };

describe("checkPastedKey", () => {
  it("accepts secret and restricted keys in the mode the environment allows", () => {
    expect(checkPastedKey("  rk_test_51Habc123XYZ ", preview)).toEqual({ key: "rk_test_51Habc123XYZ", livemode: false });
    expect(checkPastedKey("sk_test_51Habc123XYZ", {})).toEqual({ key: "sk_test_51Habc123XYZ", livemode: false });
    expect(checkPastedKey("rk_live_51Habc123XYZ", production)).toEqual({ key: "rk_live_51Habc123XYZ", livemode: true });
  });

  it("refuses the wrong mode with the env key's reasons", () => {
    expect(checkPastedKey("rk_live_51Habc123XYZ", preview)).toEqual({ error: "liveKeyOutsideProduction" });
    expect(checkPastedKey("rk_live_51Habc123XYZ", { ...production, DEMO_MODE: "true" })).toEqual({
      error: "liveKeyOutsideProduction",
    });
    expect(checkPastedKey("rk_test_51Habc123XYZ", production)).toEqual({ error: "testKeyInProduction" });
  });

  it("refuses anything that is not a secret or restricted key", () => {
    expect(checkPastedKey("   ", preview)).toEqual({ error: "empty" });
    expect(checkPastedKey("pk_test_51Habc123XYZ", preview)).toEqual({ error: "publishable" });
    for (const bad of ["whsec_abc12345678", "sk_test_", "rk_prod_51Habc123XYZ", "sk_test_51H abc", "hello"]) {
      expect(checkPastedKey(bad, preview)).toEqual({ error: "format" });
    }
  });
});

describe("webhookUrlFor", () => {
  it("builds the endpoint from the app's address", () => {
    expect(webhookUrlFor("https://gas.example.org")).toBe("https://gas.example.org/api/stripe/webhook");
    expect(webhookUrlFor("https://gas.example.org/")).toBe("https://gas.example.org/api/stripe/webhook");
    expect(webhookUrlFor(null)).toBeNull();
  });
});

describe("endpointsToReplace", () => {
  it("picks only the endpoints with exactly this URL", () => {
    const url = "https://gas.example.org/api/stripe/webhook";
    expect(
      endpointsToReplace(
        [
          { id: "we_1", url },
          { id: "we_2", url: `${url}/` },
          { id: "we_3", url: `${url}?x-vercel-protection-bypass=abc` },
          { id: "we_4", url: "https://other.example.org/api/stripe/webhook" },
        ],
        url,
      ),
    ).toEqual(["we_1", "we_2"]);
  });
});

describe("classifyStripeError", () => {
  it("tells a wrong key from a missing permission from anything else", () => {
    expect(classifyStripeError({ type: "StripeAuthenticationError", statusCode: 401 }, "refunds")).toEqual({
      kind: "invalidKey",
    });
    expect(classifyStripeError({ type: "StripePermissionError", statusCode: 403 }, "refunds")).toEqual({
      kind: "missingPermission",
      permission: "refunds",
    });
    expect(classifyStripeError({ statusCode: 403 }, "webhookEndpoints")).toEqual({
      kind: "missingPermission",
      permission: "webhookEndpoints",
    });
    expect(classifyStripeError({ type: "StripeInvalidRequestError", statusCode: 400 }, "webhookEndpoints")).toEqual({
      kind: "rejected",
    });
    expect(classifyStripeError({ type: "StripeConnectionError" }, "refunds")).toEqual({ kind: "unreachable" });
    expect(classifyStripeError(new Error("boom"), "refunds")).toEqual({ kind: "unreachable" });
    expect(classifyStripeError(null, "refunds")).toEqual({ kind: "unreachable" });
  });
});

describe("accountLabelOf", () => {
  it("prefers the dashboard name, then the business name, then the id", () => {
    expect(accountLabelOf({ id: "acct_1", settings: { dashboard: { display_name: "GAS Riva" } } })).toBe("GAS Riva");
    expect(accountLabelOf({ id: "acct_1", business_profile: { name: "Riva APS" } })).toBe("Riva APS");
    expect(accountLabelOf({ id: "acct_1", settings: { dashboard: { display_name: "" } } })).toBe("acct_1");
    expect(accountLabelOf(null)).toBeNull();
  });
});

describe("disconnectBlockers", () => {
  it("lists what Stripe still has to tell the app", () => {
    expect(disconnectBlockers({ pendingPayments: 0, openRefunds: 0, unsettledCycles: 0 })).toEqual([]);
    expect(disconnectBlockers({ pendingPayments: 2, openRefunds: 0, unsettledCycles: 1 })).toEqual([
      "pendingPayments",
      "unsettledCycles",
    ]);
  });
});

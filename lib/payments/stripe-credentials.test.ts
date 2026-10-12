import { describe, expect, it, vi } from "vitest";
import { sealSecret } from "./stripe-secret-box";

// The resolution is pure; the module's database reader is never reached here.
vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    throw new Error("no database in unit tests");
  },
}));

const { resolveStripeCredentials } = await import("./stripe-credentials");

const AUTH_SECRET = "auth-secret-of-this-deploy-for-tests";

function row(key: string, overrides: Partial<{ webhookSecretEnc: string }> = {}) {
  return {
    secretKeyEnc: sealSecret(key, "secret_key", AUTH_SECRET),
    webhookSecretEnc: sealSecret("whsec_app", "webhook_secret", AUTH_SECRET),
    webhookEndpointId: "we_1",
    livemode: key.includes("_live_"),
    accountLabel: "GAS Riva",
    connectedAt: new Date("2026-10-01T10:00:00Z"),
    connectedBy: "admin@example.invalid",
    ...overrides,
  };
}

describe("resolveStripeCredentials", () => {
  it("uses the env when STRIPE_SECRET_KEY is set, ignoring a stored connection", () => {
    const env = { STRIPE_SECRET_KEY: "sk_live_env", STRIPE_WEBHOOK_SECRET: " whsec_env ", VERCEL_ENV: "production", AUTH_SECRET };
    expect(resolveStripeCredentials(env, row("rk_live_app"))).toEqual({
      source: "env",
      status: { enabled: true, secretKey: "sk_live_env", livemode: true },
      webhookSecret: "whsec_env",
    });
  });

  it("keeps the env's refusals and a missing webhook secret as they were", () => {
    expect(resolveStripeCredentials({ STRIPE_SECRET_KEY: "sk_test_env", VERCEL_ENV: "production" }, row("rk_live_app"))).toEqual({
      source: "env",
      status: { enabled: false, reason: "testKeyInProduction" },
      webhookSecret: null,
    });
  });

  it("is none without an env key or a stored connection", () => {
    expect(resolveStripeCredentials({ AUTH_SECRET }, null)).toEqual({
      source: "none",
      status: { enabled: false, reason: "missing" },
    });
  });

  it("opens the stored connection and applies the same mode rules", () => {
    const preview = resolveStripeCredentials({ AUTH_SECRET, VERCEL_ENV: "preview" }, row("rk_test_app"));
    expect(preview).toMatchObject({
      source: "app",
      status: { enabled: true, secretKey: "rk_test_app", livemode: false },
      webhookSecret: "whsec_app",
      unreadable: false,
      connection: { accountLabel: "GAS Riva", webhookEndpointId: "we_1" },
    });
    expect(resolveStripeCredentials({ AUTH_SECRET, VERCEL_ENV: "production" }, row("rk_test_app")).status).toEqual({
      enabled: false,
      reason: "testKeyInProduction",
    });
    expect(resolveStripeCredentials({ AUTH_SECRET, VERCEL_ENV: "preview" }, row("rk_live_app")).status).toEqual({
      enabled: false,
      reason: "liveKeyOutsideProduction",
    });
  });

  it("is unreadable, and disabled, when AUTH_SECRET changed", () => {
    const creds = resolveStripeCredentials({ AUTH_SECRET: "rotated", VERCEL_ENV: "preview" }, row("rk_test_app"));
    expect(creds).toMatchObject({ source: "app", unreadable: true, webhookSecret: null, status: { enabled: false } });
  });

  it("is unreadable when only the webhook secret does not open", () => {
    const creds = resolveStripeCredentials({ AUTH_SECRET }, row("rk_test_app", { webhookSecretEnc: "v1.x.y.z" }));
    expect(creds).toMatchObject({ source: "app", unreadable: true, status: { enabled: false } });
  });
});

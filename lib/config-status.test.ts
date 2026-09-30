import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { configStatus, MIGRATIONS, type ConfigFacts, type ConfigItem } from "./config-status";

const facts: ConfigFacts = { appliedMigrations: [...MIGRATIONS], brandWarnings: [] };
const complete = {
  DATABASE_URL: "postgres://x",
  AUTH_SECRET: "s",
  AUTH_GOOGLE_ID: "g",
  AUTH_GOOGLE_SECRET: "g",
  NEXT_PUBLIC_BRAND_JSON: "{}",
  RESEND_API_KEY: "re_x",
  MAIL_FROM: "GAS <noreply@example.org>",
  APP_BASE_URL: "https://gas.example.org",
  VERCEL_ENV: "production",
};
const item = (items: ConfigItem[], id: string) => items.find((i) => i.id === id)!;

describe("MIGRATIONS", () => {
  it("lists every file in drizzle/, in order", () => {
    const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
    expect(MIGRATIONS).toEqual(files);
  });
});

describe("configStatus", () => {
  it("is all green for a complete production deploy, optional integrations off", () => {
    const items = configStatus(complete, facts);
    expect(items.filter((i) => i.status === "missing" || i.status === "warning")).toEqual([]);
    expect(item(items, "stripe").status).toBe("off");
    expect(item(items, "membership").status).toBe("off");
    expect(item(items, "sentry").status).toBe("off");
  });

  it("never carries a value, only variable names", () => {
    const text = JSON.stringify(configStatus({ ...complete, STRIPE_SECRET_KEY: "sk_live_secret" }, facts));
    for (const secret of ["postgres://x", "re_x", "sk_live_secret", "noreply@example.org"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("flags what a deploy cannot run without", () => {
    const items = configStatus({}, { appliedMigrations: null, brandWarnings: [] });
    expect(item(items, "database")).toMatchObject({ status: "missing", required: true });
    expect(item(items, "authSecret")).toMatchObject({ status: "missing", required: true });
    expect(item(items, "signIn")).toMatchObject({ status: "missing", required: true });
  });

  it("signs in by email link, with Google as an extra", () => {
    expect(item(configStatus(complete, facts), "signIn")).toMatchObject({ status: "ok", note: "emailAndGoogle" });
    const noGoogle = { ...complete, AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "" };
    expect(item(configStatus(noGoogle, facts), "signIn")).toMatchObject({ status: "ok", note: "emailOnly" });
    const noEmail = { ...complete, RESEND_API_KEY: "" };
    expect(item(configStatus(noEmail, facts), "signIn")).toMatchObject({ status: "warning", note: "googleOnly" });
  });

  it("names the migrations not applied yet, and a database it cannot read", () => {
    const pending = configStatus(complete, { appliedMigrations: MIGRATIONS.slice(0, -1), brandWarnings: [] });
    expect(item(pending, "database")).toMatchObject({ status: "warning", note: "pendingMigrations", detail: [MIGRATIONS.at(-1)] });
    const unreachable = configStatus(complete, { appliedMigrations: null, brandWarnings: [] });
    expect(item(unreachable, "database")).toMatchObject({ status: "warning", note: "databaseUnreachable" });
  });

  it("warns about email that cannot leave a non-production deploy", () => {
    const staging = configStatus({ ...complete, VERCEL_ENV: "preview" }, facts);
    expect(item(staging, "email")).toMatchObject({ status: "warning", note: "noRedirect" });
    const ok = configStatus({ ...complete, VERCEL_ENV: "preview", EMAIL_REDIRECT_TO: "me@example.org" }, facts);
    expect(item(ok, "email").status).toBe("ok");
    expect(item(configStatus({ ...complete, RESEND_API_KEY: "" }, facts), "email").status).toBe("off");
  });

  it("reads the Stripe key like the app does, and wants its webhook secret", () => {
    const live = configStatus({ ...complete, STRIPE_SECRET_KEY: "sk_live_x" }, facts);
    expect(item(live, "stripe")).toMatchObject({ status: "warning", note: "noWebhookSecret" });
    const ok = configStatus({ ...complete, STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec" }, facts);
    expect(item(ok, "stripe")).toMatchObject({ status: "ok", note: "live" });
    const wrongMode = configStatus({ ...complete, STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec" }, facts);
    expect(item(wrongMode, "stripe")).toMatchObject({ status: "warning", note: "testKeyInProduction" });
  });

  it("wants both membership-card variables or none", () => {
    expect(item(configStatus({ ...complete, WALLYFOR_API_KEY: "k" }, facts), "membership").status).toBe("warning");
    expect(
      item(configStatus({ ...complete, WALLYFOR_API_KEY: "k", WALLYFOR_MERCHANT_ID: "m" }, facts), "membership").status,
    ).toBe("ok");
  });

  it("warns about the default brand and about contrast problems", () => {
    expect(item(configStatus({ ...complete, NEXT_PUBLIC_BRAND_JSON: "" }, facts), "brand")).toMatchObject({
      status: "warning",
      note: "defaultBrand",
    });
    expect(item(configStatus(complete, { ...facts, brandWarnings: ["a", "b"] }), "brand")).toMatchObject({
      status: "warning",
      note: "contrast",
      detail: ["a", "b"],
    });
  });

  it("warns when email links would have no address", () => {
    const { APP_BASE_URL: _drop, ...rest } = complete;
    void _drop;
    expect(item(configStatus(rest, facts), "baseUrl").status).toBe("warning");
    expect(item(configStatus({ ...rest, VERCEL_PROJECT_PRODUCTION_URL: "gas.vercel.app" }, facts), "baseUrl").status).toBe("ok");
  });

  it("does not ask the demo for Google: it signs in with its own buttons", () => {
    expect(item(configStatus({ ...complete, AUTH_GOOGLE_ID: "", DEMO_MODE: "true" }, facts), "signIn")).toMatchObject({
      status: "ok",
      required: false,
    });
  });
});

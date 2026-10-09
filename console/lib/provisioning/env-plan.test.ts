import { describe, expect, it } from "vitest";
import { appEnvVars, emailEnvVars, envKeys, randomSecret, stripeEnvVars } from "./env-plan";

const input = {
  databaseUrl: "postgres://u:p@h/db",
  authSecret: "a".repeat(64),
  bootstrapAdminEmail: "admin@riva.it",
  appBaseUrl: "https://wegrocery-riva.vercel.app",
  brandJson: '{"appName":"Riva"}',
  timeZone: "Europe/Rome",
  statsSecret: "b".repeat(64),
};

describe("appEnvVars", () => {
  const vars = appEnvVars(input);
  const byKey = Object.fromEntries(vars.map((v) => [v.key, v]));

  it("writes every variable the instance needs", () => {
    expect(envKeys(vars)).toBe(
      "DATABASE_URL, MIGRATE_ON_BUILD, AUTH_SECRET, BOOTSTRAP_ADMIN_EMAIL, APP_BASE_URL, NEXT_PUBLIC_BRAND_JSON, NEXT_PUBLIC_TIME_ZONE, INSTANCE_STATS_SECRET",
    );
  });

  it("keeps the database and the migrations on production only", () => {
    expect(byKey.DATABASE_URL.target).toEqual(["production"]);
    expect(byKey.MIGRATE_ON_BUILD.target).toEqual(["production"]);
  });

  it("marks the secrets sensitive and never targets development with them", () => {
    for (const k of ["DATABASE_URL", "AUTH_SECRET", "INSTANCE_STATS_SECRET"]) {
      expect(byKey[k].type).toBe("sensitive");
      expect(byKey[k].target).not.toContain("development");
    }
    expect(byKey.NEXT_PUBLIC_BRAND_JSON.type).toBe("encrypted");
  });
});

describe("other steps", () => {
  it("email and Stripe keys are sensitive", () => {
    expect(emailEnvVars("re_x", "A <a@b.c>")[0]).toMatchObject({ key: "RESEND_API_KEY", type: "sensitive" });
    expect(stripeEnvVars("sk", "whsec").map((v) => [v.key, v.type, v.target])).toEqual([
      ["STRIPE_SECRET_KEY", "sensitive", ["production"]],
      ["STRIPE_WEBHOOK_SECRET", "sensitive", ["production"]],
    ]);
  });
  it("generates 32-byte hex secrets", () => {
    const s = randomSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(randomSecret()).not.toBe(s);
  });
});

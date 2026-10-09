import { randomBytes } from "node:crypto";
import type { EnvVar } from "@/lib/providers/vercel";

// The environment variables each wizard step writes to the instance's Vercel
// project, pure. Secrets are `sensitive` (unreadable after creation, so they
// never come back to the console either); the rest `encrypted`, Vercel's
// default. DATABASE_URL and MIGRATE_ON_BUILD are production-only: a preview
// must never reach, let alone migrate, the group's database.

const BOTH: EnvVar["target"] = ["production", "preview"];
const PROD: EnvVar["target"] = ["production"];

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export interface AppEnvInput {
  databaseUrl: string;
  authSecret: string;
  bootstrapAdminEmail: string;
  appBaseUrl: string;
  brandJson: string;
  timeZone: string;
  statsSecret: string;
}

export function appEnvVars(i: AppEnvInput): EnvVar[] {
  return [
    { key: "DATABASE_URL", value: i.databaseUrl, type: "sensitive", target: PROD },
    { key: "MIGRATE_ON_BUILD", value: "true", type: "encrypted", target: PROD },
    { key: "AUTH_SECRET", value: i.authSecret, type: "sensitive", target: BOTH },
    { key: "BOOTSTRAP_ADMIN_EMAIL", value: i.bootstrapAdminEmail, type: "encrypted", target: BOTH },
    { key: "APP_BASE_URL", value: i.appBaseUrl, type: "encrypted", target: PROD },
    { key: "NEXT_PUBLIC_BRAND_JSON", value: i.brandJson, type: "encrypted", target: BOTH },
    { key: "NEXT_PUBLIC_TIME_ZONE", value: i.timeZone, type: "encrypted", target: BOTH },
    { key: "INSTANCE_STATS_SECRET", value: i.statsSecret, type: "sensitive", target: PROD },
  ];
}

export function emailEnvVars(apiKey: string, mailFrom: string): EnvVar[] {
  return [
    { key: "RESEND_API_KEY", value: apiKey, type: "sensitive", target: BOTH },
    { key: "MAIL_FROM", value: mailFrom, type: "encrypted", target: BOTH },
  ];
}

/** Stripe keys go to production only: live keys only work there anyway. */
export function stripeEnvVars(secretKey: string, webhookSecret: string): EnvVar[] {
  return [
    { key: "STRIPE_SECRET_KEY", value: secretKey, type: "sensitive", target: PROD },
    { key: "STRIPE_WEBHOOK_SECRET", value: webhookSecret, type: "sensitive", target: PROD },
  ];
}

export function baseUrlEnvVar(appBaseUrl: string): EnvVar[] {
  return [{ key: "APP_BASE_URL", value: appBaseUrl, type: "encrypted", target: PROD }];
}

/** Keys only, for audit entries and messages. */
export function envKeys(vars: EnvVar[]): string {
  return vars.map((v) => v.key).join(", ");
}

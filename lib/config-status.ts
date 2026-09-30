import { MIGRATIONS } from "./migrations";
import { REQUIRED_STRIPE_EVENTS, resolveStripeKey } from "./payments/config";

export { MIGRATIONS };

// What a deploy has set up, as names and states only: never a value. Shown in
// admin -> Impostazioni and printed by `npm run doctor`, so whoever installs
// WeGrocery for a group sees what is missing and where to set it (the
// variables live in the hosting project's environment, never in the app).

type Env = Record<string, string | undefined>;

export type ConfigFacts = {
  // Names in the database's _migrations table; null = it could not be read.
  appliedMigrations: readonly string[] | null;
  // brandContrastWarnings() of the deploy's theme.
  brandWarnings: readonly string[];
};

export type ConfigItemId =
  | "database"
  | "authSecret"
  | "signIn"
  | "brand"
  | "baseUrl"
  | "email"
  | "stripe"
  | "membership"
  | "sentry";

export type ConfigItem = {
  id: ConfigItemId;
  // ok: set up. missing: the app cannot work without it. warning: set up but
  // something is off. off: an optional integration that is not set up.
  status: "ok" | "missing" | "warning" | "off";
  required: boolean;
  // The environment variables this item reads.
  vars: readonly string[];
  // Why the status, for the explanation next to it.
  note?: string;
  // Names worth listing (pending migrations, Stripe events, brand warnings).
  detail?: readonly string[];
};

const set = (v: string | undefined) => Boolean(v?.trim());

function database(env: Env, facts: ConfigFacts): ConfigItem {
  const base = { id: "database", required: true, vars: ["DATABASE_URL"] } as const;
  if (!set(env.DATABASE_URL)) return { ...base, status: "missing" };
  if (facts.appliedMigrations === null) return { ...base, status: "warning", note: "databaseUnreachable" };
  const applied = new Set(facts.appliedMigrations);
  const pending = MIGRATIONS.filter((m) => !applied.has(m));
  return pending.length > 0
    ? { ...base, status: "warning", note: "pendingMigrations", detail: pending }
    : { ...base, status: "ok" };
}

function email(env: Env): ConfigItem {
  const base = { id: "email", required: false, vars: ["RESEND_API_KEY", "MAIL_FROM", "EMAIL_REDIRECT_TO"] } as const;
  if (!set(env.RESEND_API_KEY) || !set(env.MAIL_FROM)) return { ...base, status: "off" };
  // Outside production every email is redirected; without an address it is
  // refused (lib/email). The demo sends nothing anyway.
  const production = env.VERCEL_ENV === "production";
  if (!production && env.DEMO_MODE !== "true" && !set(env.EMAIL_REDIRECT_TO)) {
    return { ...base, status: "warning", note: "noRedirect" };
  }
  return { ...base, status: "ok" };
}

function stripe(env: Env): ConfigItem {
  const base = {
    id: "stripe",
    required: false,
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    detail: REQUIRED_STRIPE_EVENTS,
  } as const;
  if (!set(env.STRIPE_SECRET_KEY)) return { ...base, status: "off" };
  const key = resolveStripeKey(env);
  if (!key.enabled) return { ...base, status: "warning", note: key.reason };
  if (!set(env.STRIPE_WEBHOOK_SECRET)) return { ...base, status: "warning", note: "noWebhookSecret" };
  return { ...base, status: "ok", note: key.livemode ? "live" : "test" };
}

// The email link is the way in (it needs email set up); Google is optional.
// The demo signs in with its own one-click buttons instead.
function signIn(env: Env): ConfigItem {
  const google = set(env.AUTH_GOOGLE_ID) && set(env.AUTH_GOOGLE_SECRET);
  const emailLink = set(env.RESEND_API_KEY) && set(env.MAIL_FROM);
  const demo = env.DEMO_MODE === "true";
  const base = { id: "signIn", required: !demo, vars: ["RESEND_API_KEY", "MAIL_FROM", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] } as const;
  if (demo) return { ...base, status: "ok", note: "demoSignIn" };
  if (emailLink) return { ...base, status: "ok", note: google ? "emailAndGoogle" : "emailOnly" };
  return google ? { ...base, status: "warning", note: "googleOnly" } : { ...base, status: "missing" };
}

export function configStatus(env: Env, facts: ConfigFacts): ConfigItem[] {
  const wallyfor = [set(env.WALLYFOR_API_KEY), set(env.WALLYFOR_MERCHANT_ID)];
  return [
    database(env, facts),
    {
      id: "authSecret",
      required: true,
      vars: ["AUTH_SECRET"],
      status: set(env.AUTH_SECRET) ? "ok" : "missing",
    },
    signIn(env),
    {
      id: "brand",
      required: false,
      vars: ["NEXT_PUBLIC_BRAND_JSON"],
      ...(!set(env.NEXT_PUBLIC_BRAND_JSON)
        ? { status: "warning" as const, note: "defaultBrand" }
        : facts.brandWarnings.length > 0
          ? { status: "warning" as const, note: "contrast", detail: facts.brandWarnings }
          : { status: "ok" as const }),
    },
    {
      id: "baseUrl",
      required: false,
      vars: ["APP_BASE_URL"],
      ...(set(env.APP_BASE_URL) || set(env.VERCEL_PROJECT_PRODUCTION_URL)
        ? { status: "ok" as const }
        : { status: "warning" as const, note: "noBaseUrl" }),
    },
    email(env),
    stripe(env),
    {
      id: "membership",
      required: false,
      vars: ["WALLYFOR_API_KEY", "WALLYFOR_MERCHANT_ID"],
      status: wallyfor.every(Boolean) ? "ok" : wallyfor.some(Boolean) ? "warning" : "off",
    },
    {
      id: "sentry",
      required: false,
      vars: ["SENTRY_DSN"],
      status: set(env.SENTRY_DSN) ? "ok" : "off",
    },
  ];
}

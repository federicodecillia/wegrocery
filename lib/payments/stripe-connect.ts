import { isLiveStripeKey, stripeModeRefusal } from "./config";

// The decisions of connecting the group's Stripe account from the app
// (lib/actions/admin-stripe.ts): which pasted keys are accepted, where the
// webhook goes, what a Stripe error means for the admin, and when the
// connection may be removed. Pure, unit tested.

type Env = Record<string, string | undefined>;

export type PastedKeyError =
  | "empty"
  | "publishable"
  | "format"
  | "liveKeyOutsideProduction"
  | "testKeyInProduction";

// A secret (sk_) or restricted (rk_) key, test or live, in the mode this
// environment accepts (the same rules as STRIPE_SECRET_KEY).
export function checkPastedKey(input: string, env: Env): { key: string; livemode: boolean } | { error: PastedKeyError } {
  const key = input.trim();
  if (!key) return { error: "empty" };
  if (/^pk_/.test(key)) return { error: "publishable" };
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{8,}$/.test(key)) return { error: "format" };
  const livemode = isLiveStripeKey(key);
  const refusal = stripeModeRefusal(livemode, env);
  return refusal ? { error: refusal } : { key, livemode };
}

export const WEBHOOK_PATH = "/api/stripe/webhook";

// The endpoint Stripe calls; null without a public address for the app.
export function webhookUrlFor(baseUrl: string | null): string | null {
  return baseUrl ? `${baseUrl.replace(/\/+$/, "")}${WEBHOOK_PATH}` : null;
}

// Endpoints of the account that already point at exactly this URL (a
// previous connection of this app): replaced by the new one, so Stripe does
// not deliver every event twice with a secret the app no longer has. Others,
// including the same path with a query (staging's bypass), are left alone.
export function endpointsToReplace(endpoints: readonly { id: string; url: string }[], url: string): string[] {
  const norm = (u: string) => u.replace(/\/+$/, "");
  return endpoints.filter((e) => norm(e.url) === norm(url)).map((e) => e.id);
}

// The restricted-key permissions the app needs, as Stripe's dashboard names
// them, with the level to pick.
export const STRIPE_PERMISSIONS = {
  checkoutSessions: { name: "Checkout Sessions", level: "write" },
  paymentIntents: { name: "PaymentIntents", level: "read" },
  refunds: { name: "Refunds", level: "write" },
  webhookEndpoints: { name: "Webhook Endpoints", level: "write" },
} as const;

export type StripePermission = keyof typeof STRIPE_PERMISSIONS;

export type StripeCallProblem =
  | { kind: "invalidKey" }
  | { kind: "missingPermission"; permission: StripePermission }
  // Stripe understood the request and refused it (e.g. a webhook URL it does
  // not accept, such as localhost).
  | { kind: "rejected" }
  | { kind: "unreachable" };

// What a failed Stripe call made while connecting tells the admin. The SDK's
// errors carry `type` (StripeAuthenticationError, StripePermissionError, ...)
// and `statusCode`.
export function classifyStripeError(err: unknown, permission: StripePermission): StripeCallProblem {
  const { type, statusCode } = (typeof err === "object" && err !== null ? err : {}) as {
    type?: unknown;
    statusCode?: unknown;
  };
  if (type === "StripeAuthenticationError" || statusCode === 401) return { kind: "invalidKey" };
  if (type === "StripePermissionError" || statusCode === 403) return { kind: "missingPermission", permission };
  if (type === "StripeInvalidRequestError" || statusCode === 400) return { kind: "rejected" };
  return { kind: "unreachable" };
}

// A name the admin recognizes for the connected account, when the key may
// read it: the dashboard's display name, the business name, else the id.
export function accountLabelOf(
  account: {
    id?: string | null;
    settings?: { dashboard?: { display_name?: string | null } | null } | null;
    business_profile?: { name?: string | null } | null;
  } | null,
): string | null {
  if (!account) return null;
  const label = account.settings?.dashboard?.display_name || account.business_profile?.name || account.id || null;
  return label ? label.slice(0, 120) : null;
}

export type StripeMoneyInFlight = {
  // Checkouts opened recently and not resolved yet.
  pendingPayments: number;
  // Refunds asked of Stripe or on their way.
  openRefunds: number;
  // Pay-per-order cycles running, or closed and not settled.
  unsettledCycles: number;
};

export type DisconnectBlocker = keyof StripeMoneyInFlight;

// Disconnecting deletes the webhook endpoint: whatever Stripe still has to
// tell the app (a payment, a refund) would be lost, and card cycles could not
// be settled. Also checked before replacing a working connection with
// another key, for the same reason.
export function disconnectBlockers(state: StripeMoneyInFlight): DisconnectBlocker[] {
  return (Object.keys(state) as DisconnectBlocker[]).filter((k) => state[k] > 0);
}

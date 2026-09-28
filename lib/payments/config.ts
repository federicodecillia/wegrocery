// Online top-up rules and Stripe key policy. Pure (no env reads, no I/O) so
// they are unit tested; lib/payments/stripe.ts applies them to process.env.

// Range and one-tap amounts of a single top-up. The lower bound keeps
// Stripe's fixed fee (0.25 €) a small share of what the member tops up.
export const TOPUP_MIN_CENTS = 2000;
export const TOPUP_MAX_CENTS = 30000;
export const TOPUP_PRESETS_CENTS = [2500, 5000, 10000] as const;

export type TopupAmountError = "invalid" | "tooLow" | "tooHigh";

// "50", "50,5", "50.50" -> cents. At most two decimals, no signs, no
// thousands separators: anything else is "invalid" rather than guessed.
export function parseTopupAmount(
  input: string,
): { cents: number } | { error: TopupAmountError } {
  const trimmed = input.trim();
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(trimmed)) return { error: "invalid" };
  const [whole, frac = ""] = trimmed.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (cents < TOPUP_MIN_CENTS) return { error: "tooLow" };
  if (cents > TOPUP_MAX_CENTS) return { error: "tooHigh" };
  return { cents };
}

// process.env, or a literal in tests. Reads STRIPE_SECRET_KEY, VERCEL_ENV and
// DEMO_MODE.
type StripeEnv = Record<string, string | undefined>;

export type StripeKeyStatus =
  | { enabled: true; secretKey: string; livemode: boolean }
  | { enabled: false; reason: "missing" | "liveKeyOutsideProduction" | "testKeyInProduction" };

// Live keys move real money, so they only work on a real production deploy.
// Test keys are refused there: a test top-up would credit a member's real
// balance with money that never arrived. The demo is a production deploy with
// fake data, so it counts as "not production" here.
export function resolveStripeKey(env: StripeEnv): StripeKeyStatus {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { enabled: false, reason: "missing" };
  const isRealProduction = env.VERCEL_ENV === "production" && env.DEMO_MODE !== "true";
  const livemode = /^(sk|rk)_live_/.test(key);
  if (livemode && !isRealProduction) return { enabled: false, reason: "liveKeyOutsideProduction" };
  if (!livemode && isRealProduction) return { enabled: false, reason: "testKeyInProduction" };
  return { enabled: true, secretKey: key, livemode };
}

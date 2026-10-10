import Stripe from "stripe";
import { getStripeCredentials } from "./stripe-credentials";

// Server-only Stripe client. null when online top-ups are off for this deploy
// (no key, or a key whose mode does not match the environment: see
// resolveStripeKey). Callers hide the card top-up instead of failing. The key
// is the env's or, without one, the group's in-app connection
// (lib/payments/stripe-credentials.ts).
let cached: { secretKey: string; client: Stripe } | null = null;

export function stripeClientFor(secretKey: string): Stripe {
  if (cached?.secretKey !== secretKey) cached = { secretKey, client: new Stripe(secretKey) };
  return cached.client;
}

export async function getStripe(): Promise<Stripe | null> {
  const { status } = await getStripeCredentials();
  if (!status.enabled) return null;
  return stripeClientFor(status.secretKey);
}

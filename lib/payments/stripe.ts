import Stripe from "stripe";
import { resolveStripeKey } from "./config";

// Server-only Stripe client. null when online top-ups are off for this deploy
// (no key, or a key whose mode does not match the environment: see
// resolveStripeKey). Callers hide the card top-up instead of failing.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const status = resolveStripeKey(process.env);
  if (!status.enabled) return null;
  client ??= new Stripe(status.secretKey);
  return client;
}

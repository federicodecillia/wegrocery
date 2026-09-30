import { reportError } from "@/lib/observability";
import { resolveStripeKey } from "@/lib/payments/config";
import { getStripe } from "@/lib/payments/stripe";
import { applyWebhookAction, planWebhookAction } from "@/lib/payments/webhook";

// Stripe -> app notifications for online payments and their refunds. Public
// (excluded from the auth middleware): authenticity comes from the signature,
// verified on the raw body with STRIPE_WEBHOOK_SECRET. Amounts always come
// from the signed event or from Stripe's API, never from the success redirect.
// The endpoint subscribes to REQUIRED_STRIPE_EVENTS (lib/payments/config.ts).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 404 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // A sandbox endpoint must never move a production balance, and vice versa.
  const key = resolveStripeKey(process.env);
  if (!key.enabled || event.livemode !== key.livemode) {
    return new Response("Mode mismatch", { status: 400 });
  }

  try {
    await applyWebhookAction(planWebhookAction(event));
  } catch (e) {
    // 500 makes Stripe retry with backoff; the handlers are idempotent.
    reportError("stripe webhook", e, { eventType: event.type, eventId: event.id });
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

import { REQUIRED_STRIPE_EVENTS } from "./config";

// Whether the Stripe account has a webhook endpoint pointing at this app with
// every event the app needs (first-run setup → Verifiche). Pure: the action
// lists the endpoints with the deploy's key and passes them in.

export type WebhookEndpointLike = { url: string; status: string; enabled_events: readonly string[] };

export type WebhookCheck =
  | { status: "ok" }
  | { status: "missingEndpoint" }
  | { status: "disabled" }
  | { status: "missingEvents"; missing: string[] };

const normalize = (url: string) => url.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();

export function checkWebhookEndpoints(
  endpoints: readonly WebhookEndpointLike[],
  expectedUrl: string,
  required: readonly string[] = REQUIRED_STRIPE_EVENTS,
): WebhookCheck {
  // The staging endpoint carries Vercel's bypass in its query: compared without it.
  const ours = endpoints.filter((e) => normalize(e.url) === normalize(expectedUrl));
  if (ours.length === 0) return { status: "missingEndpoint" };
  const enabled = ours.filter((e) => e.status === "enabled");
  if (enabled.length === 0) return { status: "disabled" };
  const events = new Set(enabled.flatMap((e) => e.enabled_events));
  if (events.has("*")) return { status: "ok" };
  const missing = required.filter((e) => !events.has(e));
  return missing.length > 0 ? { status: "missingEvents", missing } : { status: "ok" };
}

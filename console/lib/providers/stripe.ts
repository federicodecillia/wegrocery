import { errorMessageFrom, fetchWithTimeout, ProviderError, readJson, type FetchLike } from "@/lib/http";

// Thin adapter over the Stripe API for the one thing the console does with
// the GROUP's own Stripe key: create the webhook endpoint of its instance.
// The key is used for these calls and handed to Vercel; it is never stored.

const API = "https://api.stripe.com/v1";
const SERVICE = "Stripe";

/**
 * Copied from the main app's lib/payments/config.ts (REQUIRED_STRIPE_EVENTS):
 * keep the two lists in step. The console is a separate package and cannot
 * import it.
 */
export const REQUIRED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
] as const;

export interface StripeKeyInfo {
  kind: "secret" | "restricted";
  mode: "live" | "test";
}

export function classifyStripeKey(key: string): StripeKeyInfo | null {
  const m = /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/.exec(key.trim());
  if (!m) return null;
  return { kind: m[1] === "sk" ? "secret" : "restricted", mode: m[2] as "live" | "test" };
}

export function webhookUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/api/stripe/webhook`;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  secret?: string;
}

export function stripeClient({ secretKey, fetchImpl = fetch }: { secretKey: string; fetchImpl?: FetchLike }) {
  async function call<T>(method: string, path: string, form?: URLSearchParams): Promise<T> {
    let res: Response;
    try {
      res = await fetchWithTimeout(fetchImpl, `${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: form?.toString(),
      });
    } catch {
      throw new ProviderError(SERVICE, 0, "network error");
    }
    const body = await readJson(res);
    if (!res.ok) throw new ProviderError(SERVICE, res.status, errorMessageFrom(body, "request failed"));
    return body as T;
  }

  return {
    listWebhookEndpoints() {
      return call<{ data: WebhookEndpoint[] }>("GET", "/webhook_endpoints?limit=100");
    },
    deleteWebhookEndpoint(id: string) {
      return call<{ id: string; deleted: boolean }>("DELETE", `/webhook_endpoints/${encodeURIComponent(id)}`);
    },
    createWebhookEndpoint(url: string, description: string) {
      const form = new URLSearchParams();
      form.set("url", url);
      form.set("description", description);
      for (const e of REQUIRED_STRIPE_EVENTS) form.append("enabled_events[]", e);
      return call<WebhookEndpoint>("POST", "/webhook_endpoints", form);
    },

    /**
     * Idempotent: an endpoint already pointing at `url` is deleted first,
     * because Stripe shows a signing secret only once, at creation.
     */
    async replaceWebhookEndpoint(url: string, description: string): Promise<{ id: string; secret: string }> {
      const existing = await this.listWebhookEndpoints();
      for (const ep of existing.data ?? []) {
        if (ep.url === url) await this.deleteWebhookEndpoint(ep.id);
      }
      const created = await this.createWebhookEndpoint(url, description);
      if (!created.secret) throw new ProviderError(SERVICE, 0, "endpoint creato senza segreto di firma");
      return { id: created.id, secret: created.secret };
    },
  };
}

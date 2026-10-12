"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { ActionError, actionErrorMessage } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { auditLog, stripeConnection } from "@/lib/db/schema";
import { getAppBaseUrl } from "@/lib/email/base-url";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/observability";
import { REQUIRED_STRIPE_EVENTS } from "@/lib/payments/config";
import {
  accountLabelOf,
  checkPastedKey,
  classifyStripeError,
  disconnectBlockers,
  endpointsToReplace,
  STRIPE_PERMISSIONS,
  webhookUrlFor,
  type StripePermission,
} from "@/lib/payments/stripe-connect";
import { readStripeMoneyInFlight } from "@/lib/payments/stripe-connection-store";
import {
  clearStripeCredentialsCache,
  envHasStripeKey,
  readStripeConnection,
  resolveStripeCredentials,
} from "@/lib/payments/stripe-credentials";
import { sealSecret } from "@/lib/payments/stripe-secret-box";

// Admin → Impostazioni → Collegamento a Stripe: the group connects its own
// Stripe account by pasting a restricted key. The app checks the key's
// permissions with harmless reads, creates the webhook endpoint itself and
// stores both secrets sealed (lib/payments/stripe-credentials.ts). While
// STRIPE_SECRET_KEY is set none of this is offered: the host's keys win.
// Audit rows carry the mode, the account label and the endpoint id, never a
// secret.

const e = () => t.admin.settings.stripeConnection.errors;

// A failed Stripe call while connecting, as a message for the admin.
async function call<T>(permission: StripePermission, run: () => Promise<T>, webhookUrl?: string): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const problem = classifyStripeError(err, permission);
    switch (problem.kind) {
      case "invalidKey":
        throw new ActionError(e().invalidKey);
      case "missingPermission": {
        const p = STRIPE_PERMISSIONS[problem.permission];
        throw new ActionError(e().missingPermission(p.name, t.admin.settings.stripeConnection.levels[p.level]));
      }
      case "rejected":
        if (webhookUrl) throw new ActionError(e().rejected(webhookUrl));
        throw err;
      case "unreachable":
        reportError("stripe connect", err, { permission });
        throw new ActionError(e().unreachable);
    }
  }
}

async function refuseWhileMoneyInFlight(): Promise<void> {
  const blockers = disconnectBlockers(await readStripeMoneyInFlight(getDb()));
  if (blockers.length > 0) throw new ActionError(`${e().blocked} ${e().blockers[blockers[0]]}`);
}

function revalidateStripe() {
  revalidatePath("/admin");
  revalidatePath("/ricarica");
}

export async function adminConnectStripe(form: FormData): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (envHasStripeKey(process.env)) return { error: e().envSet };
    // On the public demo every visitor is an admin: nobody may point its card
    // payments at their own Stripe account.
    if (process.env.DEMO_MODE === "true") return { error: e().demo };
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) return { error: e().noAuthSecret };

    const raw = form.get("key");
    const checked = checkPastedKey(typeof raw === "string" ? raw : "", process.env);
    if ("error" in checked) return { error: e()[checked.error] };
    const url = webhookUrlFor(getAppBaseUrl());
    if (!url) return { error: e().noBaseUrl };

    // Replacing a working connection loses what Stripe still has to tell the
    // old endpoint: the same refusals as disconnecting. An unreadable one is
    // already lost, so it can always be replaced.
    const previous = resolveStripeCredentials(process.env, await readStripeConnection());
    const previousKey = previous.source === "app" && previous.status.enabled ? previous.status.secretKey : null;
    if (previous.source === "app" && !previous.unreadable) await refuseWhileMoneyInFlight();

    const stripe = new Stripe(checked.key);
    // Harmless reads, one per permission the app needs.
    await call("checkoutSessions", () => stripe.checkout.sessions.list({ limit: 1 }));
    await call("paymentIntents", () => stripe.paymentIntents.list({ limit: 1 }));
    await call("refunds", () => stripe.refunds.list({ limit: 1 }));
    const endpoints = await call("webhookEndpoints", () => stripe.webhookEndpoints.list({ limit: 100 }));

    // An endpoint of a previous connection of this app: removed, so Stripe
    // does not post every event twice with a secret the app no longer has.
    const stale = endpointsToReplace(endpoints.data, url);
    for (const id of stale) await call("webhookEndpoints", () => stripe.webhookEndpoints.del(id));
    if (previous.source === "app" && previousKey && !stale.includes(previous.connection.webhookEndpointId)) {
      // The old endpoint on the old key's account (another account, or an
      // address that has changed since): best effort.
      try {
        await new Stripe(previousKey).webhookEndpoints.del(previous.connection.webhookEndpointId);
      } catch {
        // Already gone, or not ours to delete any more.
      }
    }

    const endpoint = await call(
      "webhookEndpoints",
      () =>
        stripe.webhookEndpoints.create({
          url,
          enabled_events: [...REQUIRED_STRIPE_EVENTS],
          description: "WeGrocery",
          // Events shaped like the SDK the app reads them with.
          api_version: Stripe.API_VERSION,
        }),
      url,
    );
    if (!endpoint.secret) throw new ActionError(e().unreachable);

    // Restricted keys usually may not read the account: no label then.
    let accountLabel: string | null = null;
    try {
      accountLabel = accountLabelOf(await stripe.accounts.retrieveCurrent());
    } catch {
      accountLabel = null;
    }

    const now = new Date();
    const values = {
      secretKeyEnc: sealSecret(checked.key, "secret_key", authSecret),
      webhookSecretEnc: sealSecret(endpoint.secret, "webhook_secret", authSecret),
      webhookEndpointId: endpoint.id,
      livemode: checked.livemode,
      accountLabel,
      connectedAt: now,
      connectedBy: admin.email,
    };
    const db = getDb();
    try {
      await db.batch([
        db
          .insert(stripeConnection)
          .values({ id: 1, ...values })
          .onConflictDoUpdate({ target: stripeConnection.id, set: values }),
        db.insert(auditLog).values({
          auditId: crypto.randomUUID(),
          userEmail: admin.email,
          action: "stripe_connect",
          entityType: "stripe_connection",
          entityId: "1",
          payloadJson: JSON.stringify({
            livemode: checked.livemode,
            keyType: checked.key.slice(0, 2),
            accountLabel,
            webhookEndpointId: endpoint.id,
            webhookUrl: url,
            replacedEndpoints: stale,
            replacedConnection: previous.source === "app",
          }),
          createdAt: now,
        }),
      ]);
    } catch (err) {
      // Nothing stored: do not leave an endpoint whose secret nobody has.
      try {
        await stripe.webhookEndpoints.del(endpoint.id);
      } catch {
        // The next connection replaces it by its URL.
      }
      throw err;
    }
    clearStripeCredentialsCache();
    revalidateStripe();
    return {};
  } catch (err) {
    clearStripeCredentialsCache();
    return { error: actionErrorMessage(err, t.errors.genericError, "adminConnectStripe") };
  }
}

export async function adminDisconnectStripe(): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (envHasStripeKey(process.env)) return { error: e().envSet };
    const current = resolveStripeCredentials(process.env, await readStripeConnection());
    if (current.source !== "app") {
      clearStripeCredentialsCache();
      revalidateStripe();
      return {};
    }
    await refuseWhileMoneyInFlight();

    let endpointDeleted = false;
    if (current.status.enabled) {
      try {
        await new Stripe(current.status.secretKey).webhookEndpoints.del(current.connection.webhookEndpointId);
        endpointDeleted = true;
      } catch {
        // Already gone, or Stripe unreachable: the admin can delete it on Stripe.
      }
    }

    const db = getDb();
    await db.batch([
      db.delete(stripeConnection).where(eq(stripeConnection.id, 1)),
      db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "stripe_disconnect",
        entityType: "stripe_connection",
        entityId: "1",
        payloadJson: JSON.stringify({
          livemode: current.connection.livemode,
          accountLabel: current.connection.accountLabel,
          webhookEndpointId: current.connection.webhookEndpointId,
          endpointDeleted,
          unreadable: current.unreadable,
        }),
        createdAt: new Date(),
      }),
    ]);
    clearStripeCredentialsCache();
    revalidateStripe();
    return {};
  } catch (err) {
    return { error: actionErrorMessage(err, t.errors.genericError, "adminDisconnectStripe") };
  }
}

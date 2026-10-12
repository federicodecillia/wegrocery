import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isUndefinedTable } from "@/lib/db/errors";
import { stripeConnection } from "@/lib/db/schema";
import { applyStripeKeyPolicy, resolveStripeKey, type StripeKeyStatus } from "./config";
import { openSecret } from "./stripe-secret-box";

// Which Stripe account this deploy uses, and with which secrets. Two sources:
//   env  STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET, set by whoever hosts the
//        app. When the key is set the database is never read: behaviour is
//        exactly what it was before the in-app connection existed.
//   app  the group's own account, connected by an admin in Impostazioni
//        (table stripe_connection, lib/actions/admin-stripe.ts), its secrets
//        sealed with AUTH_SECRET.
// Either way the key goes through the same live/test policy as the env key.

type Env = Record<string, string | undefined>;

export type StripeConnectionInfo = {
  livemode: boolean;
  accountLabel: string | null;
  connectedAt: Date;
  connectedBy: string;
  webhookEndpointId: string;
};

export type StoredStripeConnection = StripeConnectionInfo & {
  secretKeyEnc: string;
  webhookSecretEnc: string;
};

export type StripeCredentials =
  | { source: "env"; status: StripeKeyStatus; webhookSecret: string | null }
  | {
      source: "app";
      status: StripeKeyStatus;
      webhookSecret: string | null;
      connection: StripeConnectionInfo;
      // The stored secrets do not open (AUTH_SECRET changed): connect again.
      unreadable: boolean;
    }
  | { source: "none"; status: { enabled: false; reason: "missing" } };

const NONE: StripeCredentials = { source: "none", status: { enabled: false, reason: "missing" } };

export function envHasStripeKey(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

// Pure: the credentials in force for this env and stored row.
export function resolveStripeCredentials(env: Env, row: StoredStripeConnection | null): StripeCredentials {
  if (envHasStripeKey(env)) {
    return { source: "env", status: resolveStripeKey(env), webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || null };
  }
  if (!row) return NONE;
  const connection: StripeConnectionInfo = {
    livemode: row.livemode,
    accountLabel: row.accountLabel,
    connectedAt: row.connectedAt,
    connectedBy: row.connectedBy,
    webhookEndpointId: row.webhookEndpointId,
  };
  const key = openSecret(row.secretKeyEnc, "secret_key", env.AUTH_SECRET);
  const webhookSecret = openSecret(row.webhookSecretEnc, "webhook_secret", env.AUTH_SECRET);
  if (!key || !webhookSecret) {
    return { source: "app", status: { enabled: false, reason: "missing" }, webhookSecret: null, connection, unreadable: true };
  }
  return { source: "app", status: applyStripeKeyPolicy(key, env), webhookSecret, connection, unreadable: false };
}

// The stored row, or null without one, or without the table (migration 0035
// not applied yet). Any other database error is thrown.
export async function readStripeConnection(): Promise<StoredStripeConnection | null> {
  try {
    const [row] = await getDb().select().from(stripeConnection).where(eq(stripeConnection.id, 1)).limit(1);
    if (!row) return null;
    return {
      secretKeyEnc: row.secretKeyEnc,
      webhookSecretEnc: row.webhookSecretEnc,
      webhookEndpointId: row.webhookEndpointId,
      livemode: row.livemode,
      accountLabel: row.accountLabel,
      connectedAt: row.connectedAt,
      connectedBy: row.connectedBy,
    };
  } catch (e) {
    if (isUndefinedTable(e)) return null;
    throw e;
  }
}

// A short module cache over the per-request one: a webhook burst or a busy
// page does not read the row each time. Connect and disconnect clear it on
// the instance that ran them; other instances catch up within the TTL.
const TTL_MS = 30_000;
let moduleCache: { at: number; value: StripeCredentials } | null = null;

export function clearStripeCredentialsCache(): void {
  moduleCache = null;
}

export const getStripeCredentials = cache(async (): Promise<StripeCredentials> => {
  // The env key wins without touching the database.
  if (envHasStripeKey(process.env)) return resolveStripeCredentials(process.env, null);
  if (moduleCache && Date.now() - moduleCache.at < TTL_MS) return moduleCache.value;
  const value = resolveStripeCredentials(process.env, await readStripeConnection());
  moduleCache = { at: Date.now(), value };
  return value;
});

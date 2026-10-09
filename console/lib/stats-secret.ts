import { env } from "@/lib/env";
import { decryptSecret, encryptSecret, parseKey } from "@/lib/crypto/secret-box";

// The stored INSTANCE_STATS_SECRET of an instance, encrypted with
// CONSOLE_ENCRYPTION_KEY and bound to the instance id.

export function sealStatsSecret(instanceId: string, secret: string): string {
  return encryptSecret(secret, parseKey(env.encryptionKey()), instanceId);
}

/** The plain secret, or null when none is stored or it cannot be decrypted. */
export function openStatsSecret(instanceId: string, sealed: string | null): string | null {
  if (!sealed) return null;
  try {
    return decryptSecret(sealed, parseKey(env.encryptionKey()), instanceId);
  } catch {
    return null;
  }
}

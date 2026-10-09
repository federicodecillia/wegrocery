import { createHmac } from "node:crypto";

// Request signature for GET /api/instance-stats on a WeGrocery instance.
// Contract (shared with the main app):
//   x-wegrocery-timestamp: unix seconds
//   x-wegrocery-signature: lowercase hex HMAC-SHA256, keyed with the
//     instance's INSTANCE_STATS_SECRET, of `${timestamp}.GET./api/instance-stats`
// The instance accepts a clock skew of at most 300 s and a secret of at
// least 32 characters.

export const STATS_PATH = "/api/instance-stats";
export const MAX_CLOCK_SKEW_SECONDS = 300;
export const MIN_STATS_SECRET_LENGTH = 32;

export function statsSignature(secret: string, timestamp: number, method = "GET", path = STATS_PATH): string {
  return createHmac("sha256", secret).update(`${timestamp}.${method}.${path}`).digest("hex");
}

export function signedStatsHeaders(secret: string, nowSeconds: number): Record<string, string> {
  if (secret.length < MIN_STATS_SECRET_LENGTH) {
    throw new Error(`INSTANCE_STATS_SECRET must be at least ${MIN_STATS_SECRET_LENGTH} characters`);
  }
  const timestamp = Math.floor(nowSeconds);
  return {
    "x-wegrocery-timestamp": String(timestamp),
    "x-wegrocery-signature": statsSignature(secret, timestamp),
  };
}

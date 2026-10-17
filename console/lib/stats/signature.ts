import { createHmac } from "node:crypto";

// Request signature for GET /api/instance-stats on a WeGrocery instance.
// Contract (the FlyLabs Kit module `console`, shared with the main app):
//   x-flylabs-timestamp: unix seconds
//   x-flylabs-signature: lowercase hex HMAC-SHA256, keyed with the
//     instance's INSTANCE_STATS_SECRET, of `${timestamp}.GET./api/instance-stats`
// The same pair goes out as x-wegrocery-* too: an instance from before the
// kit (1.30 and older) reads only those and answers its older shape, which
// parseStats still accepts. A newer instance prefers x-flylabs-*.
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
  const timestamp = String(Math.floor(nowSeconds));
  const signature = statsSignature(secret, Number(timestamp));
  return {
    "x-flylabs-timestamp": timestamp,
    "x-flylabs-signature": signature,
    "x-wegrocery-timestamp": timestamp,
    "x-wegrocery-signature": signature,
  };
}

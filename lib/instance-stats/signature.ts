import { createHmac, timingSafeEqual } from "node:crypto";
import { MIN_SECRET_LENGTH } from "./constants";

export { MIN_SECRET_LENGTH };

// Requests to /api/instance-stats are signed by whoever operates several
// installations (a fleet console): an HMAC-SHA256, keyed with this deploy's
// INSTANCE_STATS_SECRET, of "<unix seconds>.<METHOD>.<path>". The timestamp
// bounds a replay to MAX_SKEW_SECONDS. Pure: the route passes the clock.

export const TIMESTAMP_HEADER = "x-wegrocery-timestamp";
export const SIGNATURE_HEADER = "x-wegrocery-signature";
export const MAX_SKEW_SECONDS = 300;

export function signingPayload(timestamp: string, method: string, path: string): string {
  return `${timestamp}.${method.toUpperCase()}.${path}`;
}

export function signRequest(secret: string, timestamp: string, method: string, path: string): string {
  return createHmac("sha256", secret).update(signingPayload(timestamp, method, path)).digest("hex");
}

export type VerifyInput = {
  secret: string | undefined;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  nowSeconds: number;
};

// true only for a configured secret, a fresh timestamp and a matching
// signature. Every failure looks the same to the caller (the route answers
// 404), so a probe learns nothing about which part was wrong.
export function verifyRequest(input: VerifyInput): boolean {
  const secret = input.secret?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  if (!input.timestamp || !/^\d{1,12}$/.test(input.timestamp)) return false;
  if (Math.abs(input.nowSeconds - Number(input.timestamp)) > MAX_SKEW_SECONDS) return false;
  if (!input.signature || !/^[0-9a-f]{64}$/.test(input.signature)) return false;
  const expected = Buffer.from(signRequest(secret, input.timestamp, input.method, input.path), "hex");
  return timingSafeEqual(expected, Buffer.from(input.signature, "hex"));
}

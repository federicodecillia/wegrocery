import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// The operator session: a stateless token `v1.<expires>.<nonce>.<mac>`,
// HMAC-SHA256 over the first three parts. The key mixes the session secret
// with a hash of the password, so changing CONSOLE_PASSWORD (or the secret)
// signs every session out. Pure: the caller passes the clock.

export const SESSION_COOKIE = "wgc_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

function macKey(secret: string, password: string): Buffer {
  const pw = createHash("sha256").update(password).digest("hex");
  return createHmac("sha256", secret).update(`session-key\0${pw}`).digest();
}

function mac(body: string, secret: string, password: string): string {
  return createHmac("sha256", macKey(secret, password)).update(body).digest("base64url");
}

/** Constant-time string equality (lengths leak, contents do not). */
export function safeEqual(a: string, b: string): boolean {
  // Compare fixed-length digests so the length check cannot short-circuit.
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db) && a.length === b.length;
}

export function createSessionToken(
  secret: string,
  password: string,
  nowSeconds: number,
  nonce: string = randomBytes(12).toString("base64url"),
): { token: string; expiresAt: number } {
  const expiresAt = nowSeconds + SESSION_TTL_SECONDS;
  const body = `v1.${expiresAt}.${nonce}`;
  return { token: `${body}.${mac(body, secret, password)}`, expiresAt };
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  password: string,
  nowSeconds: number,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  // A token cannot claim to live longer than a session does.
  if (expiresAt > nowSeconds + SESSION_TTL_SECONDS) return false;
  const body = parts.slice(0, 3).join(".");
  return safeEqual(parts[3], mac(body, secret, password));
}

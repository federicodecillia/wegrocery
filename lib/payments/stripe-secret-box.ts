import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Seals the Stripe secrets of an in-app connection (table stripe_connection)
// so a database dump alone does not hand out the group's Stripe account.
// AES-256-GCM with a key derived from AUTH_SECRET (HKDF-SHA256), a random
// 12-byte IV per value and the field name as associated data, so a value
// copied into the other column does not open. Stored as
// v1.<iv>.<tag>.<ciphertext>, base64url. Pure apart from the random IV.
//
// Rotating AUTH_SECRET makes stored values unreadable: openSecret returns
// null and the admin connects again.

const VERSION = "v1";
const SALT = "wegrocery-stripe-connection";
const INFO = "wegrocery stripe connection v1";

export type SealedField = "secret_key" | "webhook_secret";

function keyFrom(authSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", authSecret, SALT, INFO, 32));
}

export function sealSecret(plain: string, field: SealedField, authSecret: string): string {
  if (!authSecret) throw new Error("AUTH_SECRET is required to seal a secret");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(authSecret), iv);
  cipher.setAAD(Buffer.from(field, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

// null when the value is malformed, was sealed for another field, was altered,
// or AUTH_SECRET is not the one it was sealed with. Never throws.
export function openSecret(sealed: string, field: SealedField, authSecret: string | undefined): string | null {
  if (!authSecret) return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64url"));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(authSecret), iv);
    decipher.setAAD(Buffer.from(field, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

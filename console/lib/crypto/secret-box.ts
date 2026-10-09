import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for the one secret the registry keeps: each instance's
// INSTANCE_STATS_SECRET (it only unlocks anonymous counts). The ciphertext is
// bound to its instance id (additional authenticated data), so a value copied
// onto another row does not decrypt. Format: `v1:<iv>:<tag>:<ciphertext>`,
// base64url parts.

/** CONSOLE_ENCRYPTION_KEY as 32 bytes: 64 hex characters or base64 of 32 bytes. */
export function parseKey(raw: string | null | undefined): Buffer {
  const v = raw?.trim() ?? "";
  if (/^[0-9a-f]{64}$/i.test(v)) return Buffer.from(v, "hex");
  const b = Buffer.from(v, "base64");
  if (v && b.length === 32) return b;
  throw new Error("CONSOLE_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64)");
}

export function encryptSecret(plain: string, key: Buffer, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(":");
}

export function decryptSecret(payload: string, key: Buffer, context: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Unknown ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

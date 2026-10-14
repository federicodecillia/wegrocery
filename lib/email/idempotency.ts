import { createHash } from "node:crypto";

// Resend drops a second send that carries the same Idempotency-Key within 24
// hours (FlyLabs Playbook 7.6). The key must name one logical send, never "the
// same text again": two real top-ups of 10 EUR read identically and both must
// arrive. So the parts always include when the send was decided.

export function emailIdempotencyKey(...parts: ReadonlyArray<string | number | Date>): string {
  const text = parts.map((p) => (p instanceof Date ? p.toISOString() : String(p))).join("\u001f");
  return createHash("sha256").update(text).digest("hex").slice(0, 48);
}

/** The minute a send was asked in: a double click collapses, a deliberate resend later does not. */
export function minuteBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 60_000);
}

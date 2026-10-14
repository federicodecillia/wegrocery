import { createHmac, timingSafeEqual } from "node:crypto";
import { isNotificationCategory, type NotificationCategory } from "@/lib/notifications/categories";

// One-click unsubscribe (RFC 8058, FlyLabs Playbook 7.6): every notification
// email carries a link signed with HMAC-SHA256 that turns off the email channel
// of that one category for that one member. No session is needed (mail clients
// POST to it), no expiry (an old email must still work), and the signature is
// the only proof: it is derived from AUTH_SECRET, so rotating that secret
// retires every old link (the manage-preferences link in the body still works).

const CONTEXT = "wegrocery-unsubscribe-v1";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", `${CONTEXT}:${secret}`).update(payload).digest("base64url");
}

/** `<memberId>.<category>` in base64url, then the signature. */
export function signUnsubscribeToken(memberId: string, category: NotificationCategory, secret: string): string {
  const payload = Buffer.from(`${memberId}.${category}`).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): { memberId: string; category: NotificationCategory } | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0 || !secret) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const dot = decoded.lastIndexOf(".");
  if (dot < 1) return null;
  const memberId = decoded.slice(0, dot);
  const category = decoded.slice(dot + 1);
  return isNotificationCategory(category) ? { memberId, category } : null;
}

export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

/**
 * The two headers that make a mail client show an "Unsubscribe" button that
 * works in one click. Null when there is nothing to sign with or link to.
 */
export function unsubscribeHeaders(
  input: { memberId: string; category: NotificationCategory | null },
  baseUrl: string | null,
  secret: string | undefined,
): Record<string, string> | null {
  if (!input.category || !baseUrl || !secret) return null;
  const url = unsubscribeUrl(baseUrl, signUnsubscribeToken(input.memberId, input.category, secret));
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

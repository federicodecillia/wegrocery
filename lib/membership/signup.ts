// Open sign-up (drizzle/0052_signup.sql): who may join without being added by
// an admin, and the rules for the newcomers. Pure: no I/O, no imports that
// reach the database.

import { normalizeEmail } from "@/lib/member-email";

// 'closed': only members, as before. 'request': whoever is not a member fills
// in /aderisci and an admin approves. 'open': a confirmed address (the email
// link, or Google) joins at once.
export const SIGNUP_MODES = ["closed", "request", "open"] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];

// Never 'admin': the CHECK of 0052 says so too.
export const SIGNUP_ROLES = ["utenti", "attivi"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export type JoinedVia = "request" | "open";

export function isSignupMode(value: unknown): value is SignupMode {
  return typeof value === "string" && (SIGNUP_MODES as readonly string[]).includes(value);
}

export function isSignupRole(value: unknown): value is SignupRole {
  return typeof value === "string" && (SIGNUP_ROLES as readonly string[]).includes(value);
}

/**
 * The credit limit a member's order is checked against. A newcomer (joined by
 * sign-up) of a group with "prepaid" on never goes below zero, whatever the
 * group's limit, even with no limit at all; everyone else keeps the group's.
 */
export function effectiveMinBalance(
  groupMinBalance: number | null,
  member: { joinedVia: string | null },
  signupPrepaid: boolean,
): number | null {
  if (!signupPrepaid || (member.joinedVia !== "request" && member.joinedVia !== "open")) return groupMinBalance;
  return 0;
}

export const REQUEST_LIMITS = { name: 120, email: 254, phone: 40, note: 500 } as const;
// Requests from one address (IP hash) in an hour.
export const REQUESTS_PER_IP_PER_HOUR = 3;
// Rejected requests are deleted after this many days.
export const REJECTED_RETENTION_DAYS = 30;

export type RequestInput = {
  fullName: string;
  email: string;
  phone: string;
  note: string;
  // Hidden from people: a bot fills it in.
  website: string;
  acceptTerms: boolean;
};

export type ValidRequest = { fullName: string; email: string; phone: string | null; note: string | null };

export type RequestRefusal = "name" | "email" | "phone" | "note" | "terms";

// A plain shape check: the address is proven only when the member signs in.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * The fields of the /aderisci form, trimmed. `termsNeeded`: the group asks
 * for its terms to be accepted (lib/members/terms.ts), so the box must be
 * ticked. A filled honeypot is not a refusal here: the caller answers as if
 * it were received and stores nothing.
 */
export function validateRequest(
  input: RequestInput,
  termsNeeded: boolean,
): { ok: true; value: ValidRequest } | { ok: false; field: RequestRefusal } {
  const fullName = clean(input.fullName);
  if (!fullName || fullName.length > REQUEST_LIMITS.name) return { ok: false, field: "name" };
  const email = normalizeEmail(input.email);
  if (!email || email.length > REQUEST_LIMITS.email || !EMAIL_SHAPE.test(email)) return { ok: false, field: "email" };
  const phone = clean(input.phone);
  if (phone.length > REQUEST_LIMITS.phone || (phone && !/^[+0-9 ().-]+$/.test(phone))) return { ok: false, field: "phone" };
  const note = input.note.trim();
  if (note.length > REQUEST_LIMITS.note) return { ok: false, field: "note" };
  if (termsNeeded && !input.acceptTerms) return { ok: false, field: "terms" };
  return { ok: true, value: { fullName, email, phone: phone || null, note: note || null } };
}

export function isBotSubmission(input: Pick<RequestInput, "website">): boolean {
  return input.website.trim() !== "";
}

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// Membership-card check against the WallyFor API (used by Porta Moneta to
// issue its yearly membership cards). Server-side only: it reads a secret
// from env, so never import it from a client component.
//
// White-label: the check is active only when both WALLYFOR_API_KEY and
// WALLYFOR_MERCHANT_ID are set. Other deployments leave them unset and keep
// the plain members-table whitelist.
//
// API (https://wallyfor.com/wordpress/Manuale_API/manuale.html):
//   POST https://wallyfor.com/auto/api/1_0/check_validity.php
//   form-urlencoded body: email, api_key, ID (merchant id)
//   → { status: "OK" | "KO", message: string }
// "KO" covers every non-valid case (expired card, unknown email, and — as far
// as the docs say — errors too), so KO messages that look like a credentials
// problem are mapped to `error` rather than `invalid`: a wrong key must not
// read as "every member's card lapsed".

const ENDPOINT = "https://wallyfor.com/auto/api/1_0/check_validity.php";
const DEFAULT_TIMEOUT_MS = 5000;

export type WallyForConfig = { apiKey: string; merchantId: string };

export type MembershipResult =
  | { status: "valid" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

type Env = Record<string, string | undefined>;

export function getWallyForConfig(env: Env = process.env): WallyForConfig | null {
  const apiKey = env.WALLYFOR_API_KEY?.trim();
  const merchantId = env.WALLYFOR_MERCHANT_ID?.trim();
  if (!apiKey || !merchantId) return null;
  return { apiKey, merchantId };
}

export function isMembershipCheckEnabled(env: Env = process.env): boolean {
  return getWallyForConfig(env) !== null;
}

// Heuristic: KO messages about the request itself rather than the card.
const CONFIG_PROBLEM = /api[\s_-]?key|chiave|parametr|autorizz|esercente|merchant/i;

export function parseWallyForResponse(json: unknown): MembershipResult {
  if (typeof json !== "object" || json === null) {
    return { status: "error", message: "Unexpected WallyFor response" };
  }
  const { status, message } = json as { status?: unknown; message?: unknown };
  const msg = typeof message === "string" ? message : "";
  if (status === "OK") return { status: "valid" };
  if (status === "KO") {
    if (CONFIG_PROBLEM.test(msg)) return { status: "error", message: `WallyFor rejected the request: ${msg}` };
    return { status: "invalid", message: msg };
  }
  return { status: "error", message: "Unexpected WallyFor response" };
}

type CheckOptions = {
  config?: WallyForConfig | null;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};

export async function checkMembership(email: string, opts: CheckOptions = {}): Promise<MembershipResult> {
  const config = opts.config === undefined ? getWallyForConfig() : opts.config;
  if (!config) return { status: "error", message: "WallyFor is not configured" };

  const normalized = email.trim().toLowerCase();
  if (!normalized) return { status: "invalid", message: "Missing email" };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    email: normalized,
    api_key: config.apiKey,
    ID: config.merchantId,
  });

  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { status: "error", message: `WallyFor HTTP ${res.status}` };
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { status: "error", message: "WallyFor returned a non-JSON body" };
    }
    return parseWallyForResponse(json);
  } catch (err) {
    // Only the error name/message: never the request (it carries the key).
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
    return { status: "error", message: `WallyFor request failed (${reason})` };
  }
}

/**
 * Checks each distinct email in order (e.g. primary, then alias) and returns
 * the first `valid`. Without a valid one, an `error` wins over `invalid`, so a
 * flaky lookup on one address is never reported as a lapsed card.
 */
export async function checkMembershipAny(
  emails: Array<string | null | undefined>,
  check: (email: string) => Promise<MembershipResult> = (e) => checkMembership(e),
): Promise<MembershipResult> {
  const seen = new Set<string>();
  let firstInvalid: MembershipResult | null = null;
  let firstError: MembershipResult | null = null;

  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const r = await check(email);
    if (r.status === "valid") return r;
    if (r.status === "error") firstError ??= r;
    else firstInvalid ??= r;
  }
  return firstError ?? firstInvalid ?? { status: "invalid", message: "No email to check" };
}

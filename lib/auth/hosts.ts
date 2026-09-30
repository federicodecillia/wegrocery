// Hosts Better Auth answers for, which it also trusts as origins and as the
// base of the email links: this deploy's production address (APP_BASE_URL,
// else Vercel's production URL), on a preview only that deployment's own URLs,
// and localhost outside production. No wildcard: a pattern would also match
// other teams' Vercel deployments. Nothing specific to one group.

type Env = Record<string, string | undefined>;

function hostOf(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).host;
  } catch {
    return null;
  }
}

export function allowedHosts(env: Env = process.env): string[] {
  const hosts = new Set<string>();
  for (const h of [hostOf(env.APP_BASE_URL), hostOf(env.VERCEL_PROJECT_PRODUCTION_URL)]) if (h) hosts.add(h);
  if (env.VERCEL_ENV === "preview") {
    for (const h of [hostOf(env.VERCEL_URL), hostOf(env.VERCEL_BRANCH_URL)]) if (h) hosts.add(h);
  }
  // `next dev` (NODE_ENV is "production" on every Vercel build and runtime).
  if (env.NODE_ENV === "development" || (!env.VERCEL_ENV && env.NODE_ENV !== "production")) {
    hosts.add("localhost:3000");
  }
  return [...hosts];
}

// Where to fall back when a request's host is not allowed: the production
// address, else the first allowed host.
export function fallbackBaseURL(env: Env = process.env): string {
  const [first] = allowedHosts(env);
  const host = hostOf(env.APP_BASE_URL) ?? hostOf(env.VERCEL_PROJECT_PRODUCTION_URL) ?? first ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

// A path to go to after signing in: only a local path, never another site.
export function safeCallbackPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

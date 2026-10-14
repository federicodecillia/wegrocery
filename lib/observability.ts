// Error reporting. Always the server log; Sentry too when the deploy sets
// SENTRY_DSN, or NEXT_PUBLIC_SENTRY_DSN as Vercel's Sentry integration does
// (optional: without either the SDK is never loaded). instrumentation.ts
// initializes it once per server process.

type Env = Record<string, string | undefined>;
type SentryLike = { captureException: (error: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => unknown };

export function sentryDsn(env: Env): string | null {
  return env.SENTRY_DSN?.trim() || env.NEXT_PUBLIC_SENTRY_DSN?.trim() || null;
}

// A failed query's error message quotes its parameters (drizzle: "Failed
// query: <sql>\nparams: <values>"), and those can be emails or names: keep
// the statement, drop the values.
export function scrubMessage(message: string): string {
  const cut = message.indexOf("\nparams:");
  return cut === -1 ? message : message.slice(0, cut);
}

// reportError writes the error to the server log before it captures it, and
// Sentry's Console integration would attach that log line, driver parameters
// included, to the event as a breadcrumb: the log stays on the server.
export function keepBreadcrumb<T extends { category?: string }>(breadcrumb: T): T | null {
  return breadcrumb.category === "console" ? null : breadcrumb;
}

export function withoutQuery(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}

// On globalThis, not in a module variable: instrumentation.ts and each route
// are separate server bundles with their own copy of this module, so a module
// variable set at startup would stay null where reportError runs.
const SENTRY_KEY = Symbol.for("wegrocery.observability.sentry");
type WithSentry = { [SENTRY_KEY]?: SentryLike | null };

export function setSentry(client: SentryLike | null): void {
  (globalThis as WithSentry)[SENTRY_KEY] = client;
}

/** Logs an unexpected error under `scope` and forwards it to Sentry when on. Never throws. */
export function reportError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  if (extra) console.error(`[${scope}]`, error, extra);
  else console.error(`[${scope}]`, error);
  try {
    (globalThis as WithSentry)[SENTRY_KEY]?.captureException(error, { tags: { scope }, extra });
  } catch {
    // Reporting must never break the request it reports on.
  }
}

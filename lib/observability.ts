// Error reporting. Always the server log; Sentry too when the deploy sets
// SENTRY_DSN (optional: without it the SDK is never loaded). instrumentation.ts
// initializes it once per server process.

type Env = Record<string, string | undefined>;
type SentryLike = { captureException: (error: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => unknown };

export function sentryDsn(env: Env): string | null {
  return env.SENTRY_DSN?.trim() || null;
}

// A failed query's error message quotes its parameters (drizzle: "Failed
// query: <sql>\nparams: <values>"), and those can be emails or names: keep
// the statement, drop the values.
export function scrubMessage(message: string): string {
  const cut = message.indexOf("\nparams:");
  return cut === -1 ? message : message.slice(0, cut);
}

export function withoutQuery(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}

let sentry: SentryLike | null = null;

export function setSentry(client: SentryLike | null): void {
  sentry = client;
}

/** Logs an unexpected error under `scope` and forwards it to Sentry when on. Never throws. */
export function reportError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  if (extra) console.error(`[${scope}]`, error, extra);
  else console.error(`[${scope}]`, error);
  try {
    sentry?.captureException(error, { tags: { scope }, extra });
  } catch {
    // Reporting must never break the request it reports on.
  }
}

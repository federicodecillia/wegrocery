// Error reporting. Always the server log; Sentry too when the deploy sets
// SENTRY_DSN (optional: without it the SDK is never loaded). instrumentation.ts
// initializes it once per server process.

type Env = Record<string, string | undefined>;
type SentryLike = { captureException: (error: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => unknown };

export function sentryDsn(env: Env): string | null {
  return env.SENTRY_DSN?.trim() || null;
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

import { sentryDsn, setSentry } from "@/lib/observability";

// Runs once when a server process starts. Sentry is optional: without
// SENTRY_DSN the SDK is never loaded and errors only go to the server log.
export async function register() {
  const dsn = sentryDsn(process.env);
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only: no performance traces, and nothing about the member or the
    // request beyond the error itself (the SDK's defaults would send user
    // info, cookies, headers and bodies).
    tracesSampleRate: 0,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
  setSentry(Sentry);
}

// Errors thrown while rendering or in route handlers and Server Actions.
export async function onRequestError(...args: unknown[]) {
  if (!sentryDsn(process.env) || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
}

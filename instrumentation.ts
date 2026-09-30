import { after } from "next/server";
import { scrubMessage, sentryDsn, setSentry, withoutQuery } from "@/lib/observability";

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
    // info, cookies, headers, bodies, query data and local variables).
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    // A driver error quotes the failed query's parameters in its message.
    beforeSend(event) {
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubMessage(exception.value);
      }
      if (event.message) event.message = scrubMessage(event.message);
      return event;
    },
  });
  setSentry({
    captureException(error, hint) {
      Sentry.captureException(error, hint);
      // A serverless function can freeze right after its response: send the
      // event before that, without delaying the response.
      try {
        after(() => Sentry.flush(2000));
      } catch {
        void Sentry.flush(2000); // outside a request
      }
    },
  });
}

// Errors thrown while rendering or in route handlers and Server Actions.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: unknown,
) {
  if (!sentryDsn(process.env) || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  (Sentry.captureRequestError as (...a: unknown[]) => void)(
    error,
    // No query string (it can carry ids) and no headers.
    { path: withoutQuery(request.path), method: request.method, headers: {} },
    context,
  );
}

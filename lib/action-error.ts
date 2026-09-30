import { unstable_rethrow } from "next/navigation";
import { reportError } from "@/lib/observability";

// In production Next.js replaces the message of an error thrown by a Server
// Action with a generic digest, so a refusal thrown to the client never
// reaches the member or admin. Exported actions therefore return refusals as
// values and let nothing escape but Next.js control flow (redirect, notFound).
// Code they call (the auth guards, shared helpers) throws ActionError for a
// refusal the user should read; the action's catch turns it into its returned
// error with actionErrorMessage.

/** A refusal whose message is safe to show: localized, no internals. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/**
 * The message an exported Server Action returns for an error it caught.
 * Rethrows Next.js control flow first, so redirect() and notFound() still
 * work. An ActionError is shown as it is; anything else (a driver error can
 * quote SQL, or a bug) is reported under `action` and replaced by `fallback`.
 */
export function actionErrorMessage(e: unknown, fallback: string, action: string): string {
  unstable_rethrow(e);
  if (e instanceof ActionError) return e.message;
  reportError(action, e);
  return fallback;
}

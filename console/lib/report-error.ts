import { ProviderError } from "@/lib/http";

// Server log for unexpected errors: the error's class and message only.
// Provider errors never carry request bodies or headers (lib/http.ts), so no
// token or secret reaches the log.

export function reportError(where: string, e: unknown): void {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : "non-Error thrown";
  console.error(`[console:${where}] ${msg.slice(0, 500)}`);
}

/** A message safe to show the operator for an action that failed. */
export function userMessage(e: unknown, fallback = "Operazione non riuscita."): string {
  if (e instanceof ProviderError) return e.message;
  if (e instanceof Error && e.name === "UnauthorizedError") return e.message;
  return fallback;
}

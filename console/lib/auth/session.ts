import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { consolePassword, sessionSecret } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";

// Every page and every server action calls one of these: the proxy only
// redirects early, it is not the check.

export async function hasOperatorSession(): Promise<boolean> {
  // Read the cookie first, always: it makes every caller render per request,
  // even in a build that has no auth variables (never a prerendered redirect).
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = sessionSecret();
  const password = consolePassword();
  if (!secret || !password) return false;
  return verifySessionToken(token, secret, password, Date.now() / 1000);
}

/** For pages: redirects to /login without a valid session. */
export async function requireOperator(): Promise<void> {
  if (!(await hasOperatorSession())) redirect("/login");
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sessione scaduta: accedi di nuovo.");
    this.name = "UnauthorizedError";
  }
}

/** For server actions and route handlers: throws without a valid session. */
export async function assertOperator(): Promise<void> {
  if (!(await hasOperatorSession())) throw new UnauthorizedError();
}

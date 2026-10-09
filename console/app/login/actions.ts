"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit, countRecentLoginFailures, recordLoginAttempt } from "@/lib/db/queries";
import { authConfigured, consolePassword, sessionSecret } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, safeEqual } from "@/lib/auth/session-token";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MINUTES, clientIp, hashIp, underLimit } from "@/lib/request-ip";
import { reportError } from "@/lib/report-error";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!authConfigured()) return { error: "La console non è configurata." };
  const password = consolePassword()!;
  const secret = sessionSecret()!;
  const typed = String(formData.get("password") ?? "");
  const ipHash = hashIp(clientIp(await headers()), secret);

  try {
    const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
    if (!underLimit(await countRecentLoginFailures(ipHash, since), LOGIN_MAX_FAILURES)) {
      return { error: `Troppi tentativi falliti: riprova tra ${LOGIN_WINDOW_MINUTES} minuti.` };
    }
    const ok = safeEqual(typed, password);
    await recordLoginAttempt(ipHash, ok);
    if (!ok) return { error: "Password errata." };
    await audit("login", null, null);
  } catch (e) {
    // Without the registry there is no rate limit: refuse rather than guess.
    reportError("login", e);
    return { error: "Database della console non raggiungibile." };
  }

  const { token } = createSessionToken(secret, password, Math.floor(Date.now() / 1000));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

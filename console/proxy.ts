import { NextResponse, type NextRequest } from "next/server";
import { consolePassword, sessionSecret } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session-token";

// Early redirect to /login without a valid operator session. Not the access
// check itself: every page and server action verifies the session again.
// Public: /login, the intake form (/richiesta…) and the cron route (it checks
// its own bearer secret).

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/richiesta" ||
    pathname.startsWith("/richiesta/") ||
    pathname.startsWith("/api/cron/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  const secret = sessionSecret();
  const password = consolePassword();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret && password && verifySessionToken(token, secret, password, Date.now() / 1000)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};

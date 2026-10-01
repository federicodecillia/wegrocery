import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/auth/cookie";

// Only whether the session cookie is there, no database: a request without it
// goes to /login. Whether the session is valid, whose it is and whether it may
// open Admin, the page checks (lib/auth/session.ts). /login does not bounce a
// signed-in visitor from here: with a stale cookie, /login -> / -> /login
// would loop; the login page checks the real session.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/login/") || hasSessionCookie(request.cookies)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

// api/auth is Better Auth (its own allowlist), api/stripe/webhook is called by
// Stripe and authenticated by its signature, api/health is a public liveness
// check that returns no data.
export const config = {
  matcher: [
    "/((?!api/auth|api/stripe/webhook|api/health$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAccess } from "@/lib/auth/access";

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  // A member deactivated or deleted since signing in has no session any more
  // (auth.ts ends it), so they count as logged out here.
  const isLoggedIn = Boolean(req.auth?.user?.email);
  const isLoginPage = pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", origin));
  }

  // Same rule as requireAdmin: role admin and an active member.
  if (isAdminRoute && !checkAccess(req.auth?.user, "admin").ok) {
    return NextResponse.redirect(new URL("/", origin));
  }

  return NextResponse.next();
});

// api/stripe/webhook is called by Stripe, not by a signed-in member: it
// authenticates the request with the webhook signature instead. api/health
// is a public liveness check that returns no data.
export const config = {
  matcher: [
    "/((?!api/auth|api/stripe/webhook|api/health$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

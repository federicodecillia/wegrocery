import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user?.email);
  const isLoginPage = pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", origin));
  }

  if (isAdminRoute) {
    const role = (req.auth?.user as { role?: string | null } | undefined)?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  // api/cron is authenticated by CRON_SECRET (bearer), not by the session, so
  // it must bypass the session-redirect middleware like api/auth does.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

"use server";

import { cookies } from "next/headers";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

const YEAR_SECONDS = 365 * 24 * 60 * 60;

// The theme switch in the Profile (lib/theme.ts): only this browser's cookie,
// so it reads no member data and needs no session. The device's setting is the
// absence of a choice: the cookie goes. Setting a cookie in an action renders
// the page again, so the root layout writes the new data-theme and the status
// bar's colour.
export async function setThemeAction(theme: string): Promise<void> {
  if (!isTheme(theme)) return;
  const jar = await cookies();
  if (theme === "system") {
    jar.delete(THEME_COOKIE);
    return;
  }
  jar.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: YEAR_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

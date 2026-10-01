// Better Auth names its cookies "<prefix>.<name>", with "__Secure-" in front
// over https. proxy.ts only asks whether the session cookie is there
// (no database on that path); the page checks the session itself.
export const AUTH_COOKIE_PREFIX = "wegrocery";
export const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`;

export function hasSessionCookie(cookies: { has(name: string): boolean }): boolean {
  return cookies.has(SESSION_COOKIE) || cookies.has(`__Secure-${SESSION_COOKIE}`);
}

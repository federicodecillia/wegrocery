// When the app refreshes its data on its own (lot 5 of the UI review): back
// in the foreground after a while, or a tap on the bottom bar's current
// item. Never on the order page, where a refresh could land in the middle of
// an edit.

/** Back after this long in the background, the page reloads its data. */
export const REFRESH_AFTER_HIDDEN_MS = 5 * 60 * 1000;

export function refreshAllowed(pathname: string): boolean {
  return pathname !== "/ordine" && !pathname.startsWith("/ordine/");
}

export function shouldRefreshOnReturn(pathname: string, hiddenForMs: number): boolean {
  return refreshAllowed(pathname) && hiddenForMs >= REFRESH_AFTER_HIDDEN_MS;
}

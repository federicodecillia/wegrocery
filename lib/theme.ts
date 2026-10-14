// The theme: light, dark, or the device's setting, chosen in the Profile.
// The choice belongs to the browser, not to the account (a phone can stay dark
// while the office computer is light): it lives in a cookie that the root
// layout reads, so the page arrives in the right theme with no flash. Without
// the cookie the app follows the device (FlyLabs Playbook 2.3, from Stellar).

export type Theme = "light" | "dark" | "system";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

export const THEME_COOKIE = "wegrocery_theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

// Anything that is not a forced theme, the cookie missing included, is the
// device's setting.
export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

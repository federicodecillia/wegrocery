"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/theme-actions";
import { t } from "@/lib/i18n";
import { THEMES, type Theme } from "@/lib/theme";

const LABEL: Record<Theme, string> = {
  system: t.profile.themeSystem,
  light: t.profile.themeLight,
  dark: t.profile.themeDark,
};

// Writes the theme on <html> without waiting for the server.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

// The Profile row for the theme (lib/theme.ts). The page changes at once, on
// <html>; the cookie follows, and the action's render writes the same
// data-theme from the server.
export function ThemeRow({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    startTransition(() => setThemeAction(next));
  }

  return (
    <fieldset className="px-4 py-3">
      <legend className="sr-only">{t.profile.appearance}</legend>
      <div aria-hidden className="text-[14px] font-bold text-brand-near-black">
        {t.profile.appearance}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-brand-gray">{t.profile.appearanceHint}</p>
      <div className="mt-2 flex flex-wrap gap-x-6">
        {THEMES.map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-[14px] text-brand-near-black">
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => choose(value)}
              className="h-4 w-4 shrink-0 accent-[var(--primary-text)]"
            />
            {LABEL[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

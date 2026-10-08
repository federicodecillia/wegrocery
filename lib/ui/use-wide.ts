"use client";

import { useSyncExternalStore } from "react";

// Whether the screen is at least Tailwind's lg (1024 px), where pages like
// Storico show a list and its detail side by side instead of a sheet. False
// on the server and on the first client render, so hydration matches.
const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

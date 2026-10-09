// The welcome card's step, kept in this tab while the member follows one of
// its links (sessionStorage, WELCOME_STORAGE_KEY): the card resumes there and
// the bar on the other pages (welcome-resume.tsx) offers to go back.

import { isWelcomeStep, WELCOME_SEEN_KEY, WELCOME_STORAGE_KEY, type WelcomeStep } from "@/lib/guide/welcome";

export type StoredWelcome = { step: WelcomeStep; n: number; total: number };

// The raw string, so useSyncExternalStore gets an equal snapshot each render.
export function readWelcomeRaw(): string | null {
  try {
    return window.sessionStorage.getItem(WELCOME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseWelcome(raw: string | null): StoredWelcome | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredWelcome>;
    if (!isWelcomeStep(value.step ?? null) || typeof value.n !== "number" || typeof value.total !== "number") return null;
    return value as StoredWelcome;
  } catch {
    return null;
  }
}

export function storeWelcome(value: StoredWelcome | null) {
  try {
    if (value) window.sessionStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(WELCOME_STORAGE_KEY);
  } catch {
    // Private mode: the card simply starts again from the first step.
  }
}

export const subscribeNever = () => () => {};

// One id per page load: the card opens in full on the load that first shows
// it (and on client navigations within it), then folds to one line on later
// visits so the open cycle stays above the bottom bar on a phone.
const LOAD_ID = Math.random().toString(36).slice(2);

export function readSeenBefore(): boolean {
  try {
    const seen = window.localStorage.getItem(WELCOME_SEEN_KEY);
    if (seen === null) window.localStorage.setItem(WELCOME_SEEN_KEY, LOAD_ID);
    return seen !== null && seen !== LOAD_ID;
  } catch {
    return false;
  }
}

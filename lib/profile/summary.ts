// What the Profile page (app/profilo) says on each row before the member
// opens it. Pure: the page reads the data, these turn it into a state.

import type { ChannelPrefs, NotificationCategory } from "@/lib/notifications/categories";

/** Up to two letters for the header avatar: first and last word of the name, else the address. */
export function initials(fullName: string | null | undefined, email: string): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length >= 2) return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
  if (words.length === 1) return first(words[0]).toUpperCase();
  const local = email.split("@")[0] ?? "";
  const letter = [...local].find((c) => /\p{L}|\p{N}/u.test(c));
  return (letter ?? "?").toUpperCase();
}

// The first letter as the reader sees it, not the first UTF-16 unit.
function first(word: string): string {
  return [...word].find((c) => /\p{L}/u.test(c)) ?? "";
}

export type ChannelCount = { app: number; email: number; total: number };

/** How many notification groups each channel has on. */
export function countChannels(prefs: Record<NotificationCategory, ChannelPrefs>): ChannelCount {
  const values = Object.values(prefs);
  return {
    app: values.filter((p) => p.app).length,
    email: values.filter((p) => p.email).length,
    total: values.length,
  };
}

export type FamilyState =
  | { kind: "invited"; count: number }
  | { kind: "with"; names: string[] }
  | { kind: "alone" };

/**
 * The family row: a pending invitation comes first (it needs an answer),
 * then who else shares the account, else nobody.
 */
export function familyState(input: {
  personId: string;
  people: { memberId: string; fullName: string }[];
  invitesReceived: number;
}): FamilyState {
  if (input.invitesReceived > 0) return { kind: "invited", count: input.invitesReceived };
  const others = input.people.filter((p) => p.memberId !== input.personId).map((p) => p.fullName);
  return others.length > 0 ? { kind: "with", names: others } : { kind: "alone" };
}

export const NAME_MAX_LENGTH = 80;

/** A member's own display name: trimmed, inner spaces collapsed; null when empty or too long. */
export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > NAME_MAX_LENGTH) return null;
  return name;
}

// Members whose name is still the start of their address: someone who joined
// with an email link (WallyFor card holders, lib/membership/members.ts) gets
// that as a name, since no profile gives a real one. The app asks them for
// first and last name (components/name-prompt.tsx), and Admin -> Soci lists
// them. Pure: no column says "completed", the name itself does.

import { cleanName, NAME_MAX_LENGTH } from "@/lib/profile/summary";

/** Whether a group asks for the name: never, with "Più tardi", or before anything else. */
export const NAME_PROMPT_MODES = ["off", "optional", "required"] as const;
export type NamePromptMode = (typeof NAME_PROMPT_MODES)[number];

/** No row yet, or a value this code does not know: members may answer later. */
export const DEFAULT_NAME_PROMPT: NamePromptMode = "optional";

export function isNamePromptMode(value: unknown): value is NamePromptMode {
  return typeof value === "string" && (NAME_PROMPT_MODES as readonly string[]).includes(value);
}

/** "Più tardi" lasts until the browser closes: the prompt comes back at the next visit. */
export const NAME_LATER_COOKIE = "wegrocery_name_later";

const fold = (s: string) => s.trim().toLowerCase();

/**
 * True when the name is empty, an address, or the part of one of the
 * member's addresses before the @ (case-insensitive).
 */
export function nameNeedsCompleting(
  fullName: string | null | undefined,
  emails: ReadonlyArray<string | null | undefined>,
): boolean {
  const name = fold(fullName ?? "");
  if (!name || name.includes("@")) return true;
  return emails.some((e) => {
    const local = fold(e ?? "").split("@")[0];
    return Boolean(local) && local === name;
  });
}

/**
 * First and last name as one display name ("Maria Rossi"), the way
 * members.full_name keeps it. Null when either is empty or the whole is
 * longer than NAME_MAX_LENGTH.
 */
export function joinFullName(first: string, last: string): string | null {
  const f = cleanName(first);
  const l = cleanName(last);
  if (!f || !l) return null;
  return cleanName(`${f} ${l}`);
}

export { NAME_MAX_LENGTH };

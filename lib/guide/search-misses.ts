// Guide searches with no results (table guide_search_misses, migration 0032):
// what is kept of a search, and nothing that could say who typed it. Pure.

import { normalizeText } from "./search";

export const MISS_MIN = 3;
export const MISS_MAX = 60;
const MAX_WORDS = 5;
// Rows not searched again for this long are removed.
export const MISS_RETENTION_DAYS = 90;

// The words to count, or null to keep nothing: too short or too long, an
// email address, a number of 4 or more digits (phone, IBAN, card, code), or
// a sentence rather than a few words.
export function missQuery(raw: string): string | null {
  if (raw.includes("@")) return null;
  const query = normalizeText(raw);
  if (query.length < MISS_MIN || query.length > MISS_MAX) return null;
  if (/\d{4,}/.test(query.replace(/ /g, ""))) return null;
  if (query.split(" ").length > MAX_WORDS) return null;
  return query;
}

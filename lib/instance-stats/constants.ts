// Shorter INSTANCE_STATS_SECRET values are refused: the endpoint stays closed
// (404) rather than accept a key that can be guessed. Kept apart from
// signature.ts (node:crypto) so the configuration status can import it.
export const MIN_SECRET_LENGTH = 32;

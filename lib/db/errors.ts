// Postgres errors as the app receives them: the Neon driver puts the SQLSTATE
// in `code`, and drizzle wraps the driver error in DrizzleQueryError as `cause`.

const UNIQUE_VIOLATION = "23505";

/** True when `err`, or an error it wraps, is a unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  let e = err;
  for (let depth = 0; depth < 5 && typeof e === "object" && e !== null; depth++) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

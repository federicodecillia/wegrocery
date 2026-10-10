// Postgres errors as the app receives them: the Neon driver puts the SQLSTATE
// in `code` and the violated constraint in `constraint`, and drizzle wraps the
// driver error in DrizzleQueryError as `cause`.

const UNIQUE_VIOLATION = "23505";

/**
 * True when `err`, or an error in its `cause` chain, is a unique-constraint
 * violation; of `constraint` only, when given.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const { code, constraint: name, cause } = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (code === UNIQUE_VIOLATION && (constraint === undefined || name === constraint)) return true;
    current = cause;
  }
  return false;
}

const UNDEFINED_TABLE = "42P01";

/**
 * True when `err`, or an error in its `cause` chain, says a table does not
 * exist: a migration not applied yet, which a reader may treat as "no row".
 */
export function isUndefinedTable(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === UNDEFINED_TABLE) return true;
    current = cause;
  }
  return false;
}

/**
 * Postgres' default LIKE/ILIKE escape character is backslash, and drizzle's
 * `ilike()` binds the pattern as a parameter (design.md finding 8), so no
 * `ESCAPE` clause is needed. A single regex pass over the character class
 * handles the three special characters at once, so a backslash introduced by
 * escaping `%` or `_` is never re-escaped (design.md decision 20).
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function containsPattern(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}

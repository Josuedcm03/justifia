// Pure normalization helpers for the catalog Excel import (D7). No I/O, no
// dependency on any other import/* module.

/** Trim -> toLowerCase. Never strips dots or +tags: the whole normalized
 *  email is compared and stored, so aliasing tricks do not collide by
 *  accident and do not need to be special-cased. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// schema.ts: usuario.login is varchar(60).
export const LOGIN_MAX = 60;

/** Returns the normalized email as the Login, or a RowError reason when it
 *  exceeds LOGIN_MAX. NEVER truncates and NEVER suffixes (decision 7, spec:
 *  "never silently altered"). Deriving the login from the WHOLE normalized
 *  email (not just the local part) means Correo uniqueness guarantees Login
 *  uniqueness. */
export function deriveLogin(
  correo: string,
): { login: string } | { error: "loginTooLong" } {
  const login = normalizeEmail(correo);
  if (login.length > LOGIN_MAX) {
    return { error: "loginTooLong" };
  }
  return { login };
}

// Case-SENSITIVE: "2026-s1" fails on purpose (AC: Invalid periods table).
export const PERIODO_RE = /^\d{4}-S[12]$/;

const DIACRITICS_RE = /[̀-ͯ]/g;

/** Header-matching key: trim -> lowercase -> strip diacritics. Used to
 *  compare workbook column headers against the frozen sheet contract
 *  (e.g. "Código" and "codigo " both normalize to "codigo"). */
export function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
}

/** Periodo cells are trimmed only: case and content are left untouched so
 *  PERIODO_RE can reject anything that does not match exactly (X3-adjacent:
 *  no silent case-folding of a value the spec treats as case-sensitive). */
export function normalizePeriodo(raw: string): string {
  return raw.trim();
}

// Pure classification of the single sign-in field (FE-21, FE-22). No
// "server-only": it has no I/O and no dependency, and the tests run it as is.

export type LoginIdentifier =
  /** Compared with `Usuario.Correo`, ignoring case, for any role. */
  | { kind: "email"; value: string }
  /**
   * Compared exactly with `Usuario.Cif`. The value is empty when only spaces
   * and hyphens were typed after the trim; the caller then skips the lookup.
   */
  | { kind: "cif"; value: string };

/**
 * The one cleaning rule of a CIF (FE-21, FE-26): trimmed, with every space and
 * hyphen removed; the case is kept because the match is exact. The sign-in
 * lookup and the value self-registration stores both come from here, so a CIF
 * typed in any of those spellings is stored as the one the sign-in looks up.
 * The result is empty when only spaces and hyphens were typed.
 */
export function normalizeCif(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, "");
}

/**
 * An identifier that contains "@" is an email: trimmed and lower-cased (the
 * normalized email, FE-22). Any other identifier is a CIF: trimmed, with its
 * spaces and hyphens removed. No CIF format or digit count is assumed (a
 * student's CIF is digits only, the staff CIF format is unknown), and its case
 * is kept because the match is exact. A blank value gives `null`.
 *
 * The stored `Login` is deliberately not an identifier (owner decision
 * 2026-11-20, task 9.1): a former username comes out as a CIF candidate and
 * matches no student.
 */
export function classifyIdentifier(raw: string): LoginIdentifier | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.includes("@")) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }
  return { kind: "cif", value: normalizeCif(trimmed) };
}

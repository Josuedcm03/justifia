/**
 * The longest decision excerpt a request card carries (FE-15, owner resolution
 * 3 of 2026-11-20): 140 characters, shown in up to 2 lines.
 */
export const DECISION_EXCERPT_MAX = 140;

const ELLIPSIS = "…";

/**
 * The excerpt of a decision text for the student's request list, or `null`
 * when there is no text. Whitespace around the text is trimmed first. A text
 * of at most 140 characters comes back whole; a longer one keeps its first 140
 * characters, loses the whitespace the cut left at its end, and gets an
 * ellipsis. Characters are counted by code point, so a surrogate pair is never
 * split. Pure on purpose: the list reader applies it on the server so the
 * complete text never leaves it (RNF-01).
 */
export function decisionExcerpt(
  text: string | null | undefined,
): string | null {
  const trimmed = text?.trim() ?? "";
  if (trimmed === "") return null;

  const characters = Array.from(trimmed);
  if (characters.length <= DECISION_EXCERPT_MAX) return trimmed;

  return `${characters.slice(0, DECISION_EXCERPT_MAX).join("").trimEnd()}${ELLIPSIS}`;
}

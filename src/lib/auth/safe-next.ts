// Control characters: browsers strip a raw tab or newline from a URL, so
// "/<TAB>/evil.com" would resolve to "//evil.com".
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

/**
 * The post-login redirect target. One copy of the rule for `login/page.tsx`
 * and `login/actions.ts` (design D1). Allowlist of shape: a non-empty string
 * that starts with a single "/", has no "\" (browsers read it as "/") and no
 * control character. Anything else, including non-strings, gives "/".
 * Kept free of `server-only` so any test can import it.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || CONTROL_CHARACTER.test(value)) return "/";
  return value;
}

/**
 * Pages served to anyone, with or without a session (RC-11, RN-25). Kept free
 * of `server-only` so `middleware.ts`, the page and every test share one copy.
 * Only the exact path is public: `/privacy/x` and `/privacy-policy` are not.
 * A signed-in visitor is let through as well, unlike `/login` and `/register`.
 */
export const PRIVACY_PATH = "/privacy";

const PUBLIC_PAGES: ReadonlySet<string> = new Set([PRIVACY_PATH]);

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname);
}

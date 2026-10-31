import type { Locale } from "@/i18n/config";

/**
 * The catalog of a locale, loaded the way `request.ts` loads it. For code that
 * runs outside the next-intl request scope, such as a route handler building a
 * file: it builds a translator from the catalog with `createTranslator`.
 */
export async function loadMessages(locale: Locale) {
  return (await import(`../../i18n/${locale}.json`)).default;
}

import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";

export const messages = { es: esMessages, en: enMessages } as const;

export type TestLocale = keyof typeof messages;

/**
 * Render with the real catalogs. A missing key fails the test instead of
 * rendering a fallback string, so a component can never ship copy that only
 * exists in one locale.
 */
export function renderWithIntl(ui: ReactElement, locale: TestLocale = "es") {
  // A wrapper, not an inline provider, so `rerender(ui)` keeps the context.
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={messages[locale]}
        onError={(error) => {
          throw error;
        }}
      >
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}

/** Key-echo `next-intl` replacement; see `@/test/key-echo-intl` for why it
 *  lives in its own module. */
export { keyEchoIntl } from "./key-echo-intl";

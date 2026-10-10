import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";

export const messages = { es: esMessages, en: enMessages } as const;

/** Render with the real catalogs; a missing key fails the test, not the UI. */
export function renderIntl(ui: ReactElement, locale: "es" | "en" = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

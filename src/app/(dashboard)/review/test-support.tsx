import { render } from "@testing-library/react";
import {
  NextIntlClientProvider,
  createFormatter,
  createTranslator,
} from "next-intl";
import type { ReactElement } from "react";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import type { RolUsuario } from "@/lib/validations/auth";

// Shared helpers of the review page tests. Pages resolve text through the real
// catalogs and next-intl's own translator, so a key missing from either locale
// throws here instead of rendering silently.

export type Locale = "es" | "en";

export const messages = { es: esMessages, en: enMessages } as const;

const MANAGUA = "America/Managua";

/** Server-side `getTranslations` / `getFormatter` doubles for `vi.mock`. */
export function serverIntl(state: { locale: Locale }) {
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({
        locale: state.locale,
        messages: messages[state.locale],
        namespace: namespace as "review.queue",
        onError: (error: Error) => {
          throw error;
        },
      }),
    getFormatter: async () =>
      createFormatter({ locale: state.locale, timeZone: MANAGUA }),
  };
}

export function sessionFor(rol: RolUsuario, debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "caller",
    rol,
    nombre: "Caller",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

/** Render a client tree with the real catalogs; a missing key fails the test. */
export function renderIntl(ui: ReactElement, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone={MANAGUA}
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

/** `next/link` double that exposes the `prefetch` prop the guards pin. */
export function linkDouble() {
  return {
    default: ({
      href,
      prefetch,
      children,
      ...rest
    }: {
      href: string;
      prefetch?: boolean;
      children: React.ReactNode;
    }) => (
      <a href={href} data-prefetch={String(prefetch)} {...rest}>
        {children}
      </a>
    ),
  };
}

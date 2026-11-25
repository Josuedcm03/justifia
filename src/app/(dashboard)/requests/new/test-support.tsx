import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactElement, StrictMode } from "react";
import { vi } from "vitest";

import enMessages from "../../../../../i18n/en.json";
import esMessages from "../../../../../i18n/es.json";

export const messages = { es: esMessages, en: enMessages } as const;

/**
 * Render with the real catalogs; a missing key fails the test, not the UI.
 * `rerender` keeps the provider, so it takes the bare element. `strict` puts
 * StrictMode at the root, the only place where its double effect run happens.
 */
export function renderIntl(
  ui: ReactElement,
  locale: "es" | "en" = "es",
  strict = false,
) {
  const provider = (node: ReactElement) => (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      onError={(error) => {
        throw error;
      }}
    >
      {node}
    </NextIntlClientProvider>
  );
  const wrap = (node: ReactElement) =>
    strict ? <StrictMode>{provider(node)}</StrictMode> : provider(node);
  const result = render(wrap(ui));
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(wrap(next)),
  };
}

/**
 * jsdom implements neither `URL.createObjectURL` nor `URL.revokeObjectURL`.
 * These spies hand out "blob:preview-1", "blob:preview-2", and so on, so a test
 * can tell exactly which URL was created and which one was revoked.
 */
export function stubObjectUrls() {
  let n = 0;
  const createObjectURL = vi.fn((blob: Blob) => {
    void blob;
    return `blob:preview-${++n}`;
  });
  const revokeObjectURL = vi.fn((url: string) => {
    void url;
  });
  for (const [name, value] of [
    ["createObjectURL", createObjectURL],
    ["revokeObjectURL", revokeObjectURL],
  ] as const) {
    Object.defineProperty(URL, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  return { createObjectURL, revokeObjectURL };
}

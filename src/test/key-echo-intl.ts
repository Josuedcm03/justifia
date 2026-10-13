/**
 * Module replacement for `next-intl` in tests that do not care about copy:
 * every translator returns its key, like the key-echo `next-intl/server`
 * mock the async page tests already use. Install with
 *
 *   vi.mock("next-intl", async () =>
 *     (await import("@/test/key-echo-intl")).keyEchoIntl);
 *
 * It lives in its own module on purpose: `@/test/intl` imports `next-intl`
 * for the real provider, so a mock factory that imported it would wait on
 * itself and the test file would hang.
 */
export const keyEchoIntl = {
  useTranslations: (namespace?: string) => {
    void namespace;
    return (key: string, values?: Record<string, unknown>) => {
      void values;
      return key;
    };
  },
  useLocale: () => "es",
};

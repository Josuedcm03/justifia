import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// CR-I18N-1, BS-I18N-1: every user-facing string of the coordination reports
// dashboard exists in both locales, with the same keys and a non-empty message.
// Later slices extend this file with the detail and workbook keys.

function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (typeof value !== "object" || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

const catalogs = [
  ["es", es],
  ["en", en],
] as const;

describe("reports messages (dashboard)", () => {
  it("es.json and en.json hold exactly the same reports keys", () => {
    const esKeys = leaves(es.reports, "reports")
      .map(([key]) => key)
      .sort();
    const enKeys = leaves(en.reports, "reports")
      .map(([key]) => key)
      .sort();

    expect(esKeys.length).toBeGreaterThan(15);
    expect(enKeys).toEqual(esKeys);
  });

  it.each(catalogs)(
    "%s has a non-empty text for every reports key",
    (_locale, messages) => {
      for (const [key, text] of leaves(messages.reports, "reports")) {
        expect(typeof text, key).toBe("string");
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    },
  );

  it("names the sidebar entry in both catalogs", () => {
    expect(es.nav.reports).toBe("Reportes");
    expect(en.nav.reports).toBe("Reports");
  });

  it.each(catalogs)(
    "%s offers the home shortcut text for the reports entry",
    (_locale, messages) => {
      const shortcuts = messages.dashboard.shortcuts as Record<string, string>;

      expect(shortcuts.reports?.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(catalogs)(
    "%s covers the page states and the three rankings",
    (_locale, messages) => {
      const keys = leaves(messages.reports, "reports").map(([key]) => key);

      for (const key of [
        "reports.title",
        "reports.description",
        "reports.period.label",
        "reports.period.all",
        "reports.period.apply",
        "reports.noCareer.title",
        "reports.noCareer.message",
        "reports.degraded",
        "reports.empty",
        "reports.requestsCount",
        "reports.classesCount",
        ...["students", "teachers", "classes"].flatMap((ranking) => [
          `reports.${ranking}.title`,
          `reports.${ranking}.description`,
          `reports.${ranking}.empty`,
        ]),
      ]) {
        expect(keys, key).toContain(key);
      }
    },
  );

  it.each([
    ["es", 1, "1 solicitud"],
    ["es", 2, "2 solicitudes"],
    ["en", 1, "1 request"],
    ["en", 2, "2 requests"],
  ] as const)(
    "%s pluralises the request count for %d",
    (locale, count, expected) => {
      const t = createTranslator({
        locale,
        messages: locale === "es" ? es : en,
        namespace: "reports",
      });

      expect(t("requestsCount", { count })).toBe(expected);
    },
  );

  it.each([
    ["es", 1, "1 clase"],
    ["es", 3, "3 clases"],
    ["en", 1, "1 class"],
    ["en", 3, "3 classes"],
  ] as const)(
    "%s pluralises the justified-class count for %d",
    (locale, count, expected) => {
      const t = createTranslator({
        locale,
        messages: locale === "es" ? es : en,
        namespace: "reports",
      });

      expect(t("classesCount", { count })).toBe(expected);
    },
  );
});

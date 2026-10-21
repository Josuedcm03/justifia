import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-11, RC-10: the privacy notice exists in both locales with the same keys,
// and neither names the mail provider (R2).

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leafValue(catalog: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    );
}

const privacy = {
  es: (es as Record<string, unknown>).privacy,
  en: (en as Record<string, unknown>).privacy,
};

describe("privacy catalog parity", () => {
  it("has a non-empty privacy subtree in both locales", () => {
    expect(leafPaths(privacy.es).length).toBeGreaterThan(10);
    expect(leafPaths(privacy.en).length).toBeGreaterThan(10);
  });

  it("has the same keys in es and en", () => {
    expect(leafPaths(privacy.en).sort()).toEqual(leafPaths(privacy.es).sort());
  });

  it("has no empty string in either locale", () => {
    for (const [locale, subtree] of Object.entries(privacy)) {
      for (const path of leafPaths(subtree)) {
        const value = leafValue(subtree, path);
        expect(typeof value, `${locale} privacy.${path}`).toBe("string");
        expect((value as string).trim(), `${locale} privacy.${path}`).not.toBe(
          "",
        );
      }
    }
  });

  it("names the facts of RC-10 as sections in both locales", () => {
    for (const subtree of Object.values(privacy)) {
      const keys = Object.keys(subtree as object);
      expect(keys).toEqual(
        expect.arrayContaining([
          "title",
          "draft",
          "version",
          "controller",
          "purpose",
          "recipients",
          "data",
          "mandatory",
          "rights",
          "retention",
        ]),
      );
    }
  });
});

describe("common.privacyNotice", () => {
  it("labels the entry-page link in both locales", () => {
    expect(es.common.privacyNotice).toBe("Aviso de privacidad");
    expect(en.common.privacyNotice).toBe("Privacy notice");
  });
});

describe("no mail provider named (R2)", () => {
  it.each(["es", "en"] as const)("%s notice never names Resend", (locale) => {
    const text = JSON.stringify(privacy[locale]);
    expect(text.length).toBeGreaterThan(200);
    expect(text).not.toMatch(/resend/i);
  });
});

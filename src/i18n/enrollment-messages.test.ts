import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-11, RNF-12 (student-enrollment "Key parity"): every user-facing string of
// /enrollment exists in both locales, with the same keys, the same placeholders
// and a non-empty message.

function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (typeof value !== "object" || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const catalogs = [
  ["es", es],
  ["en", en],
] as const;

/** Writer refusals plus `invalid` (zod) and `unexpected` (thrown): the action
 *  result codes the UI turns into `enrollment.errors.<code>`. */
const ERROR_CODES = [
  "not_student",
  "not_eligible",
  "already_enrolled",
  "not_enrolled",
  "invalid",
  "unexpected",
] as const;

const REQUIRED_KEYS = [
  "title",
  "description",
  "degraded",
  "noOffering",
  "list.title",
  "list.caption",
  "list.empty",
  "list.period",
  "list.group",
  "list.teacher",
  "list.noTeacher",
  "list.drop",
  "list.dropLabel",
  "dialog.cancel",
  "dialog.warning",
  "dialog.drop.title",
  "dialog.drop.description",
  "dialog.drop.confirm",
  "dialog.drop.pending",
  ...ERROR_CODES.map((code) => `errors.${code}`),
];

function flat(messages: { enrollment: unknown }): Map<string, string> {
  return new Map(
    leaves(messages.enrollment).map(([key, text]) => [key, text as string]),
  );
}

describe("enrollment messages", () => {
  it("es.json and en.json hold exactly the same enrollment keys", () => {
    const esKeys = [...flat(es).keys()].sort();
    const enKeys = [...flat(en).keys()].sort();

    expect(esKeys.length).toBeGreaterThanOrEqual(REQUIRED_KEYS.length);
    expect(enKeys).toEqual(esKeys);
  });

  it.each(catalogs)(
    "%s defines every key the page and dialogs read",
    (_l, m) => {
      const keys = flat(m);

      for (const key of REQUIRED_KEYS) expect(keys.has(key), key).toBe(true);
    },
  );

  it.each(catalogs)("%s has a non-empty text for every key", (_l, m) => {
    for (const [key, text] of flat(m)) {
      expect(typeof text, key).toBe("string");
      expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("both locales use the same placeholders in every message", () => {
    const esMessages = flat(es);

    for (const [key, text] of flat(en)) {
      expect(placeholders(esMessages.get(key) ?? ""), key).toEqual(
        placeholders(text),
      );
    }
  });
});

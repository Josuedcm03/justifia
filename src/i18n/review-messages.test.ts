import { describe, expect, it } from "vitest";

import { templateKey } from "@/app/(dashboard)/review/template-key";
import { DECISION_TEMPLATES } from "@/lib/intake/decision-templates";
import { RETURN_REASONS } from "@/lib/intake/return-reasons";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-12: every user-facing string of the review screens exists in both
// locales, with the same keys and a non-empty message.

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

describe("review messages", () => {
  it("es.json and en.json hold exactly the same review keys", () => {
    const esKeys = leaves(es.review, "review")
      .map(([key]) => key)
      .sort();
    const enKeys = leaves(en.review, "review")
      .map(([key]) => key)
      .sort();

    expect(esKeys.length).toBeGreaterThan(20);
    expect(enKeys).toEqual(esKeys);
  });

  it.each(catalogs)("%s has a non-empty text for every review key", (_l, m) => {
    for (const [key, text] of leaves(m.review, "review")) {
      expect(typeof text, key).toBe("string");
      expect((text as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it("both catalogs name the sidebar entry", () => {
    expect(es.nav.review).toBe("Revisión de solicitudes");
    expect(en.nav.review).toBe("Review requests");
  });

  it.each(catalogs)(
    "%s labels every decision template and every RN-17 reason",
    (_l, m) => {
      const { templates, reasons } = m.review.decision;

      expect(DECISION_TEMPLATES.length).toBe(6);
      for (const template of DECISION_TEMPLATES) {
        expect(
          (templates as Record<string, string>)[templateKey(template.codigo)],
          template.codigo,
        ).toBeTruthy();
      }
      for (const reason of RETURN_REASONS) {
        expect(
          (reasons as Record<string, string>)[reason],
          reason,
        ).toBeTruthy();
      }
    },
  );

  it.each(catalogs)("%s words every decision validation error", (_l, m) => {
    const codes = [
      "tipo_invalid",
      "template_unknown",
      "template_mismatch",
      "motivo_required",
      "motivo_invalid",
      "motivo_not_allowed",
      "text_required",
      "text_too_long",
      "text_placeholder",
      "conflict",
      "not_found",
      "unexpected",
    ];
    const errors = m.review.decision.errors as Record<string, string>;

    for (const code of codes) expect(errors[code], code).toBeTruthy();
  });
});

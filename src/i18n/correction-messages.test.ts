import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import { RETURN_REASONS } from "../lib/intake/return-reasons";
import es from "../../i18n/es.json";

// RNF-11, RNF-12: every user-facing string of the correction flow exists in both
// locales, with the same keys and a non-empty message, and every refusal the
// correction can report has a worded message.

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

// Codes `resubmitCorrection` and the correction actions can put on a field.
const CORRECTION_ERROR_CODES = [
  "causa_required",
  "causa_invalid",
  "start_required",
  "start_invalid",
  "end_required",
  "end_invalid",
  "end_before_start",
  "subjects_required",
  "subject_not_eligible",
  "subject_duplicate",
  "group_required",
  "group_not_in_subject",
  "documents_required",
  "too_many_documents",
  "submit_conflict",
  "not_correctable",
  "invalid_input",
];

describe("correction messages", () => {
  it("es.json and en.json hold exactly the same correction keys", () => {
    const keys = (catalog: typeof es) =>
      leaves(catalog.intake.correction, "intake.correction")
        .map(([key]) => key)
        .sort();

    expect(keys(es).length).toBeGreaterThanOrEqual(9);
    expect(keys(en)).toEqual(keys(es));
  });

  it.each(catalogs)("%s has a non-empty text for every key", (_l, m) => {
    const texts = [
      ...leaves(m.intake.correction, "intake.correction"),
      ["requests.detail.corrected", m.requests.detail.corrected],
    ];

    for (const [key, text] of texts) {
      expect(typeof text, key).toBe("string");
      expect((text as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it.each(catalogs)(
    "%s words every refusal a correction can report",
    (_l, m) => {
      const errors = m.intake.errors as Record<string, string>;

      for (const code of CORRECTION_ERROR_CODES) {
        expect(errors[code], code).toBeTruthy();
      }
    },
  );

  it.each(catalogs)(
    "%s words the return reason banner and labels every RN-17 code it can show",
    (_l, m) => {
      const { banner } = m.intake.correction;
      const reasons = m.requests.detail.reasons as Record<string, string>;

      expect(banner.title.trim().length).toBeGreaterThan(0);
      expect(banner.reason).toContain("{reason}");
      expect(RETURN_REASONS.length).toBeGreaterThan(0);
      for (const code of RETURN_REASONS) {
        expect(reasons[code], code).toBeTruthy();
      }
    },
  );

  it("words the banner differently in each language", () => {
    expect(es.intake.correction.banner.title).toBe(
      "Por qué se devolvió tu solicitud",
    );
    expect(en.intake.correction.banner.title).toBe(
      "Why your request was returned",
    );
    expect(es.intake.correction.banner.reason).toBe("Motivo: {reason}");
    expect(en.intake.correction.banner.reason).toBe("Reason: {reason}");
  });

  it("asks for the confirmation in each language, not the same text", () => {
    expect(es.intake.correction.resubmit.confirm).toBe("Sí, reenviar");
    expect(en.intake.correction.resubmit.confirm).toBe("Yes, resubmit");
    expect(es.requests.detail.corrected).not.toBe(en.requests.detail.corrected);
  });
});

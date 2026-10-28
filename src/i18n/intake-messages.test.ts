import { describe, expect, it } from "vitest";

import { CAUSAS } from "@/lib/intake/causes";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-11: every user-facing string exists in both locales.

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

// Every code an intake action, the submit validation or the client can show,
// as `intake.errors.<code>` (slice 3 apply-progress lists the server ones).
const ERROR_CODES = [
  "causa_required",
  "causa_invalid",
  "start_required",
  "start_invalid",
  "end_required",
  "end_invalid",
  "end_before_start",
  "end_too_old",
  "subjects_required",
  "subject_not_eligible",
  "subject_duplicate",
  "group_required",
  "group_not_in_subject",
  "documents_required",
  "no_draft",
  "invalid_input",
  "dates_required",
  "submit_conflict",
  "profile_incomplete",
  "unsupported_format",
  "too_large",
  "empty_file",
  "not_found",
  "not_allowed",
  "too_many_documents",
  "upload_failed",
  "consent_required",
  "consent_outdated",
] as const;

describe("intake messages", () => {
  it("es.json and en.json hold exactly the same keys", () => {
    const esKeys = leafPaths(es).sort();
    const enKeys = leafPaths(en).sort();
    expect(esKeys.length).toBeGreaterThan(100);
    expect(enKeys).toEqual(esKeys);
  });

  it.each([
    ["es", es],
    ["en", en],
  ] as const)("%s has a non-empty message for every error code", (_l, m) => {
    for (const code of ERROR_CODES) {
      const message = (
        m.intake?.errors as Record<string, string> | undefined
      )?.[code];
      expect(message, `intake.errors.${code}`).toEqual(expect.any(String));
      expect(message?.trim().length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["es", es],
    ["en", en],
  ] as const)("%s labels every cause and every step", (_l, m) => {
    const causes = m.intake?.causes as Record<string, string> | undefined;
    expect(Object.keys(causes ?? {}).sort()).toEqual([...CAUSAS].sort());
    expect(Object.keys(m.intake?.stepper?.steps ?? {})).toEqual([
      "details",
      "subjects",
      "documents",
      "review",
    ]);
  });

  it.each([
    ["es", es],
    ["en", en],
  ] as const)("%s has the review, dialog and confirmation texts", (_l, m) => {
    const texts = m.intake as unknown as Record<string, unknown>;
    const paths = leafPaths({
      review: texts.review,
      confirmation: texts.confirmation,
    });
    for (const path of [
      "review.title",
      "review.edit",
      "review.sections.subjects",
      "review.submit.confirm",
      "review.discard.confirm",
      "confirmation.title",
      "confirmation.home",
    ]) {
      expect(paths, path).toContain(path);
    }
  });

  // RC-5, RNF-12: each consent error states the correction the student makes.
  it.each([
    ["consent_required", "es", es, /marca la casilla/i],
    ["consent_required", "en", en, /check the box/i],
    ["consent_outdated", "es", es, /recarga la página.*texto actualizado/i],
    ["consent_outdated", "en", en, /reload the page.*updated text/i],
  ] as const)(
    "%s in %s states what to do",
    (code, _locale, catalog, correction) => {
      const message = (catalog.intake?.errors as Record<string, string>)[code];
      expect(message).toMatch(correction);
    },
  );

  it("has the consent label with the notice link in both locales", () => {
    for (const m of [es, en]) {
      const label = m.intake?.review?.consent?.label;
      expect(label).toMatch(/<link>[^<]+<\/link>/);
    }
  });

  // Scenario "Translation keys present": the link tells a screen reader that it
  // opens a new tab, in each locale.
  it.each([
    ["es", es, /pestaña nueva/i],
    ["en", en, /new tab/i],
  ] as const)("%s words the consent link's new-tab hint", (_l, m, hint) => {
    const newTab = m.intake?.review?.consent?.newTab;
    expect(newTab).toEqual(expect.any(String));
    expect(newTab).toMatch(hint);
  });

  // student-enrollment: the two step 2 empty states differ, and the entry
  // notice has its text and link in both locales.
  it.each([
    ["es", es],
    ["en", en],
  ] as const)(
    "%s words the step 2 empty states and the entry notice",
    (_l, m) => {
      const { subjects, enrollmentNotice } = m.intake;

      for (const text of [
        subjects.noEnrollment,
        subjects.goToEnrollment,
        subjects.empty,
        enrollmentNotice.text,
        enrollmentNotice.link,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(subjects.noEnrollment).not.toBe(subjects.empty);
    },
  );

  it("has the sidebar entry in both locales", () => {
    expect(es.nav.newRequest).toEqual(expect.any(String));
    expect(en.nav.newRequest).toEqual(expect.any(String));
  });
});

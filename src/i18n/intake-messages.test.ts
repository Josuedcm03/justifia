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
  "causa_inactive",
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

// FE-17 (RF-08 a): the preview copy of the documents step. The student screens
// address the student as "tú"; the labels with no verb are neutral. The
// accessible names keep the visible label inside them (WCAG 2.5.3).
describe("intake messages: the local preview (FE-17)", () => {
  it("words the preview controls and the hint in Spanish, in the informal address", () => {
    expect(es.intake.documents).toMatchObject({
      preview: "Vista previa",
      previewNamed: "Vista previa de {name}",
      hidePreview: "Ocultar vista previa",
      hidePreviewNamed: "Ocultar vista previa de {name}",
      previewHint:
        "Comprueba que este es el documento correcto antes de continuar.",
    });
    expect(es.intake.documents.previewHint).not.toMatch(/Compruebe/);
  });

  it("words the preview controls and the hint in English", () => {
    expect(en.intake.documents).toMatchObject({
      preview: "Preview",
      previewNamed: "Preview of {name}",
      hidePreview: "Hide preview",
      hidePreviewNamed: "Hide preview of {name}",
      previewHint: "Check that this is the right document before you continue.",
    });
  });

  it.each([
    ["es", es],
    ["en", en],
  ] as const)(
    "%s keeps the visible label inside each accessible name",
    (_l, m) => {
      const { preview, previewNamed, hidePreview, hidePreviewNamed } =
        m.intake.documents;
      expect(previewNamed.toLowerCase()).toContain(preview.toLowerCase());
      expect(hidePreviewNamed.toLowerCase()).toContain(
        hidePreview.toLowerCase(),
      );
      expect(previewNamed).toContain("{name}");
      expect(hidePreviewNamed).toContain("{name}");
    },
  );
});

// FE-16: a student tells a kept file from an added one by the word, so the two
// marks must differ and exist in both locales.
describe("intake messages: the file origin marks (FE-16)", () => {
  it.each([
    ["es", es],
    ["en", en],
  ] as const)("%s has two different mark words and a list title", (_l, m) => {
    const { filesTitle, marks } = m.intake.correction.resubmit;

    expect(marks.new.trim().length).toBeGreaterThan(0);
    expect(marks.previous.trim().length).toBeGreaterThan(0);
    expect(marks.new).not.toBe(marks.previous);
    expect(filesTitle.trim().length).toBeGreaterThan(0);
  });
});

// FE-18 and FE-19 (RF-01): the dates recap and the future-start notice. Student
// screen: the notice speaks to the student as "tú"; the other lines are labels.
describe("intake messages: the dates recap (FE-18, FE-19)", () => {
  it("words the recap and the notice in Spanish, in the informal address", () => {
    expect(es.intake.datesRecap).toEqual({
      label: "Fechas de ausencia",
      range: "Del {start} al {end}",
      edit: "Editar fechas",
      futureStart:
        "La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrige las fechas; si es una ausencia prevista, puedes continuar.",
    });
    expect(es.intake.datesRecap.futureStart).not.toMatch(/corrija|puede /);
  });

  it("words the recap and the notice in English", () => {
    expect(en.intake.datesRecap).toEqual({
      label: "Absence dates",
      range: "From {start} to {end}",
      edit: "Edit dates",
      futureStart:
        "The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue.",
    });
  });

  it("uses the label of the request card, not the design's older wording", () => {
    expect(
      es.requests.list.absence.startsWith(es.intake.datesRecap.label),
    ).toBe(true);
    expect(es.intake.datesRecap.label).not.toBe("Fechas de la ausencia");
  });
});

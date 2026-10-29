import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { templateKey } from "@/app/(dashboard)/review/template-key";
import { DECISION_TEMPLATES } from "@/lib/intake/decision-templates";
import { RETURN_REASONS } from "@/lib/intake/return-reasons";
import { REMISSION_REASONS, REMISSION_STATES } from "@/lib/remission/states";

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

  it.each(catalogs)(
    "%s words the changes section, its marks and the document fallback",
    (_l, m) => {
      const c = m.review.detail.changes;

      for (const text of [
        c.title,
        c.description,
        c.sections.causeDates,
        c.sections.subjects,
        c.sections.documents,
        c.marks.changed,
        c.marks.unchanged,
        c.retired,
        c.added,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(c.unknownDocument).toContain("{id}");
      expect(c.marks.changed).not.toBe(c.marks.unchanged);
    },
  );

  it("words the changes marks differently in each language", () => {
    expect(es.review.detail.changes.marks).toEqual({
      changed: "Modificado",
      unchanged: "Sin cambios",
    });
    expect(en.review.detail.changes.marks).toEqual({
      changed: "Changed",
      unchanged: "Unchanged",
    });
  });

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

  it.each(catalogs)(
    "%s words the remission section, its states, reasons and resend",
    (_l, m) => {
      const r = m.review.remission;

      for (const state of REMISSION_STATES) {
        expect((r.states as Record<string, string>)[state], state).toBeTruthy();
      }
      for (const reason of REMISSION_REASONS) {
        expect(
          (r.reasons as Record<string, string>)[reason],
          reason,
        ).toBeTruthy();
      }
      for (const text of [
        r.title,
        r.noTeacher,
        r.resend.action,
        r.resend.pending,
        r.resend.result.enviada,
        r.resend.result.pendiente,
        r.resend.result.bloqueada,
        r.resend.errors.not_found,
        r.resend.errors.unexpected,
      ]) {
        expect(text).toBeTruthy();
      }
    },
  );

  it.each(catalogs)(
    "%s words the special-format upload and every error it can show",
    (_l, m) => {
      const u = m.review.remission.upload;

      for (const code of [
        "not_allowed",
        "not_found",
        "already_attached",
        "empty_file",
        "too_large",
        "unsupported_format",
        "upload_failed",
        "unexpected",
      ]) {
        expect((u.errors as Record<string, string>)[code], code).toBeTruthy();
      }
      for (const text of [
        u.title,
        u.hint,
        u.action,
        u.uploading,
        u.sending,
        u.attached,
      ]) {
        expect(text).toBeTruthy();
      }
    },
  );

  // Scenario "Translation keys present" (request-review): the staff consent fact.
  it.each(catalogs)(
    "%s words the consent fact and both of its states",
    (_l, m) => {
      const d = m.review.detail;

      expect(d.fields.consent.trim().length).toBeGreaterThan(0);
      expect(d.consent.recorded).toContain("{version}");
      expect(d.consent.recorded).toContain("{date}");
      expect(d.consent.notRecorded.trim().length).toBeGreaterThan(0);
      expect(d.consent.notRecorded).not.toBe(d.consent.recorded);
    },
  );

  it("words the legacy consent label as a neutral fact in each language", () => {
    expect(es.review.detail.consent.notRecorded).toBe(
      "No registrado (presentada antes de que existiera el consentimiento)",
    );
    expect(en.review.detail.consent.notRecorded).toBe(
      "Not recorded (presented before consent existed)",
    );
  });

  it.each(catalogs)("%s words the RN-19 special-format mark", (_l, m) => {
    const mark = m.review.decision.approve.specialFormat;

    expect(mark.label).toBeTruthy();
    expect(mark.hint).toBeTruthy();
  });
});

// Scenario "Translation keys present" (request-review) and decision 3: the
// extracted-data section of the staff detail. The keys are listed on purpose:
// the generic parity test above proves both catalogs match, this one proves the
// section's own texts exist at all.
const EXTRACTION_KEYS = [
  "note",
  "fields.studentName",
  "fields.issuer",
  "fields.issueDate",
  "fields.restPeriod",
  "notRecognized",
  "restDays",
  "restRange",
  "restSingleDay",
  "states.extracting",
  "states.unavailable",
  "states.notConfigured",
  "degraded",
];

function at(tree: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      tree,
    );
}

describe("extraction section messages (RF-11)", () => {
  it.each(catalogs)(
    "%s names the section and every extraction text",
    (_l, m) => {
      expect(m.review.detail.sections.extraction.trim().length).toBeGreaterThan(
        0,
      );
      for (const key of EXTRACTION_KEYS) {
        const text = at(m.review.extraction, key);
        expect(typeof text, key).toBe("string");
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    },
  );

  it("titles the section in each language", () => {
    expect(es.review.detail.sections.extraction).toBe("Datos extraídos");
    expect(en.review.detail.sections.extraction).toBe("Extracted data");
  });

  it("words the configuration message for staff, in the usted register", () => {
    expect(es.review.extraction.states.notConfigured).toBe(
      "Hace falta configurar el servicio de extracción. Contacte al administrador del sistema.",
    );
    expect(en.review.extraction.states.notConfigured).toBe(
      "The extraction service needs to be configured. Contact the system administrator.",
    );
  });

  it.each(catalogs)(
    "%s never names the variable, the address or the key in any extraction text",
    (_l, m) => {
      const texts = leaves(m.review.extraction, "review.extraction");

      expect(texts.length).toBeGreaterThan(10);
      for (const [key, text] of texts) {
        expect(text as string, key).not.toMatch(/EXTRACTION_API/);
        expect(text as string, key).not.toMatch(/url|https?:|\bkey\b|clave/i);
      }
    },
  );

  it("addresses staff as usted in Spanish, never as tú", () => {
    for (const [key, text] of leaves(
      es.review.extraction,
      "review.extraction",
    )) {
      expect(text as string, key).not.toMatch(
        /\b(revisa|contacta|recarga|vuelve|verifica|comprueba)\b/i,
      );
    }
    expect(es.review.extraction.states.unavailable).toMatch(/\bRevise\b/);
    expect(es.review.extraction.states.extracting).toMatch(/\bVuelva\b/);
  });

  it.each([
    ["es", es, { one: "1 día", other: "5 días" }],
    ["en", en, { one: "1 day", other: "5 days" }],
  ] as const)("%s pluralizes the rest days", (locale, m, expected) => {
    const t = createTranslator({
      locale,
      messages: m,
      namespace: "review.extraction",
    });

    expect(t("restDays", { count: 1 })).toBe(expected.one);
    expect(t("restDays", { count: 5 })).toBe(expected.other);
  });

  it.each(catalogs)("%s keeps the rest placeholders", (_l, m) => {
    const x = m.review.extraction;

    for (const name of ["from", "to", "days"]) {
      expect(x.restRange).toContain(`{${name}}`);
    }
    for (const name of ["date", "days"]) {
      expect(x.restSingleDay).toContain(`{${name}}`);
    }
  });
});

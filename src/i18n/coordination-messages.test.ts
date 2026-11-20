import { describe, expect, it } from "vitest";

import { ESCALATION_KINDS } from "@/lib/intake/escalation";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-12: every user-facing string of the coordinator screens exists in both
// locales, with the same keys and a non-empty message, and the Spanish is
// neutral professional (no voseo).

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

describe("coordination messages", () => {
  it("es.json and en.json hold exactly the same coordination keys", () => {
    const esKeys = leaves(es.coordination, "coordination")
      .map(([key]) => key)
      .sort();
    const enKeys = leaves(en.coordination, "coordination")
      .map(([key]) => key)
      .sort();

    expect(esKeys.length).toBeGreaterThan(30);
    expect(enKeys).toEqual(esKeys);
  });

  it.each(catalogs)(
    "%s has a non-empty text for every coordination key",
    (_l, m) => {
      for (const [key, text] of leaves(m.coordination, "coordination")) {
        expect(typeof text, key).toBe("string");
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    },
  );

  it("both catalogs name the sidebar entry", () => {
    expect(es.nav.coordination).toBe("Solicitudes escaladas");
    expect(en.nav.coordination).toBe("Escalated requests");
  });

  it.each(catalogs)(
    "%s words the answer form with every dialog key the shared dialog reads",
    (_l, m) => {
      const dialog = m.coordination.answer.dialog;

      for (const key of [
        "trigger",
        "title",
        "description",
        "backToQueue",
        "cancel",
        "pending",
        "confirm",
        "noteLabel",
        "noteHint",
        "counter",
      ] as const) {
        expect(dialog[key], key).toBeTruthy();
      }
      expect(dialog.counter).toContain("{count}");
    },
  );

  it.each(catalogs)("%s words every refusal of the answer", (_l, m) => {
    const errors = m.coordination.answer.errors;

    for (const code of [
      "texto_required",
      "texto_too_long",
      "conflict",
      "not_found",
      "unexpected",
    ] as const) {
      expect(errors[code], code).toBeTruthy();
    }
  });

  it.each(catalogs)(
    "%s words the list, the notices and the banner",
    (_l, m) => {
      const list = m.coordination.list;

      for (const text of [
        list.title,
        list.description,
        list.open.title,
        list.open.empty,
        list.notices.title,
        list.notices.empty,
        list.noAccess.title,
        list.noAccess.message,
        list.result.respondida,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("labels the escalation reason through the shared review reasons", () => {
    for (const catalog of [es, en]) {
      for (const kind of ESCALATION_KINDS) {
        expect(
          (catalog.review.escalation.reasons as Record<string, string>)[kind],
          kind,
        ).toBeTruthy();
      }
    }
  });

  it("words the Spanish neutrally, without voseo", () => {
    const texts = leaves(es.coordination)
      .map(([, text]) => text as string)
      .join(" ");

    expect(texts).not.toMatch(
      /\b(?:escribí|elegí|seleccioná|registrá|respondé|tenés|podés|intentá|volvé|vos)\b/i,
    );
  });

  it("never shows the student's email or consent to the coordinator", () => {
    for (const catalog of [es, en]) {
      const fields = leaves(catalog.coordination.detail.fields)
        .map(([, text]) => text as string)
        .join(" ");

      expect(fields).not.toMatch(/correo|email|consent/i);
    }
  });
});

// MD-30: the read-only block of the coordination detail words the document
// type and the marks exactly as the secretary's extraction section does, so a
// coordinator reads the same text the secretary registered.
describe("coordination detail: document type and marks (MD-30)", () => {
  it.each(catalogs)(
    "%s words the types, the mark values and the labels as the review section",
    (_l, m) => {
      const detail = m.coordination.detail;
      const review = m.review.extraction;

      expect(detail.types).toEqual(review.types);
      expect(detail.markValues).toEqual(review.markValues);
      expect(detail.marks.type).toBe(review.marks.type);
      expect(detail.marks.signature).toBe(review.marks.signature);
      expect(detail.marks.seal).toBe(review.marks.seal);
    },
  );

  it.each(catalogs)(
    "%s names the block, its note and its degraded notice",
    (_l, m) => {
      const detail = m.coordination.detail;

      expect(detail.sections.marks).toBeTruthy();
      expect(detail.marks.note).toBeTruthy();
      expect(detail.marksDegraded).toBeTruthy();
    },
  );

  it("has no key that holds a value of the document or a control", () => {
    for (const catalog of [es, en]) {
      const keys = leaves(catalog.coordination.detail)
        .map(([key]) => key)
        .filter((key) => /^(marks|markValues|types)|marksDegraded/.test(key));

      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key, key).not.toMatch(
          /issuer|emisor|studentName|restPeriod|issueDate|save|form/i,
        );
      }
    }
  });
});

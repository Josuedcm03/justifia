import { describe, expect, it } from "vitest";

import { templateKey } from "@/app/(dashboard)/review/template-key";
import { DECISION_TEMPLATES } from "@/lib/intake/decision-templates";
import { ESCALATION_KINDS } from "@/lib/intake/escalation";
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

  // Scenario "Translation keys present" (request-review): the state tabs, the
  // paused-deadline badge and the texts of the two new tabs.
  it.each(catalogs)(
    "%s words the review state tabs and the paused badge",
    (_l, m) => {
      const q = m.review.queue;

      for (const text of [
        q.tabs.label,
        q.tabs.pendiente,
        q.tabs.en_revision_coordinacion,
        q.tabs.aprobada,
        q.deadline.paused,
        q.coordination.description,
        q.coordination.caption,
        q.coordination.empty,
        q.coordination.columns.escalated,
        q.coordination.columns.reason,
        q.coordination.columns.status,
        q.coordination.columns.notice,
        q.approved.description,
        q.approved.caption,
        q.approved.empty,
        q.approved.latest,
        q.approved.columns.approved,
        q.approved.columns.reports,
        q.approved.reportsCount,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(q.tabs.pendiente).not.toBe(q.tabs.aprobada);
    },
  );

  it.each(catalogs)(
    "%s words the escalation reasons and the four notification statuses",
    (_l, m) => {
      const e = m.review.escalation;

      for (const kind of ESCALATION_KINDS) {
        expect((e.reasons as Record<string, string>)[kind], kind).toBeTruthy();
      }
      for (const text of [
        e.notification.pendiente,
        e.notification.pendienteFallido,
        e.notification.enviada,
        e.notification.bloqueada,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(e.notification.enviada).toContain("{date}");
      expect(e.notification.pendiente).not.toBe(
        e.notification.pendienteFallido,
      );
    },
  );

  // Scenarios "Translation keys present" and "Refusal message names the
  // career" (request-review, coordination-escalation).
  it.each(catalogs)(
    "%s words the escalation section, dialog and every error it can show",
    (_l, m) => {
      const e = m.review.escalation;

      for (const text of [
        e.section.title,
        e.section.fields.reason,
        e.section.fields.note,
        e.section.fields.escalated,
        e.section.fields.answer,
        e.section.fields.notice,
        e.section.escalatedBy,
        e.section.answeredBy,
        e.section.waiting,
        e.dialog.trigger,
        e.dialog.title,
        e.dialog.description,
        e.dialog.noteLabel,
        e.dialog.noteHint,
        e.dialog.counter,
        e.dialog.confirm,
        e.dialog.pending,
        e.dialog.cancel,
        e.dialog.backToQueue,
        m.review.queue.result.escalada,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      for (const code of [
        "nota_required",
        "nota_too_long",
        "motivo_invalid",
        "conflict",
        "not_found",
        "unexpected",
        "sin_coordinacion",
      ]) {
        expect((e.errors as Record<string, string>)[code], code).toBeTruthy();
      }
      expect(e.dialog.counter).toContain("{count}");
    },
  );

  it.each(catalogs)(
    "%s words the report section, dialog and every error it can show",
    (_l, m) => {
      const r = m.review.report;

      for (const text of [
        r.section.title,
        r.section.empty,
        r.section.noTeachers,
        r.entry.communicated,
        r.entry.recordedBy,
        r.entry.note,
        r.dialog.trigger,
        r.dialog.title,
        r.dialog.description,
        r.dialog.teacherLabel,
        r.dialog.teacherPlaceholder,
        r.dialog.dateLabel,
        r.dialog.noteLabel,
        r.dialog.noteHint,
        r.dialog.counter,
        r.dialog.confirm,
        r.dialog.pending,
        r.dialog.cancel,
        r.dialog.backToQueue,
      ]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      for (const code of [
        "date_invalid",
        "date_future",
        "docente_invalid",
        "nota_blank",
        "nota_too_long",
        "conflict",
        "not_found",
        "unexpected",
      ]) {
        expect((r.errors as Record<string, string>)[code], code).toBeTruthy();
      }
    },
  );

  it("words the unavailable-escalation refusal with the career, neutral and without voseo", () => {
    expect(es.review.escalation.errors.sin_coordinacion).toBe(
      "{carrera} no tiene coordinación registrada; solicite al administrador que cree la cuenta.",
    );
    expect(en.review.escalation.errors.sin_coordinacion).toContain("{carrera}");
    expect(en.review.escalation.errors.sin_coordinacion).toContain(
      "administrator",
    );
  });

  it.each(catalogs)(
    "%s has the resend texts of the coordination notice",
    (_l, m) => {
      const resend = m.review.escalation.resend;

      expect(resend.action).toBeTruthy();
      expect(resend.actionNamed).toContain("{name}");
      expect(resend.pending).toBeTruthy();
      for (const state of ["enviada", "pendiente", "bloqueada"] as const) {
        expect(resend.result[state], state).toBeTruthy();
      }
      for (const code of ["not_found", "unexpected"] as const) {
        expect(resend.errors[code], code).toBeTruthy();
      }
    },
  );

  it("words the in-progress and missing-email resend outcomes neutrally", () => {
    expect(es.review.escalation.resend.result.en_curso).toBe(
      "Ya hay un envío en curso; actualice la página en unos segundos.",
    );
    expect(es.review.escalation.resend.result.sin_correo).toBe(
      "La cuenta de coordinación de la carrera no tiene correo registrado; solicite al administrador que lo agregue.",
    );
    expect(en.review.escalation.resend.result.en_curso).toBe(
      "A send is already in progress; reload the page in a few seconds.",
    );
    expect(en.review.escalation.resend.result.sin_correo).toBe(
      "The career's coordination account has no email on record; ask the administrator to add it.",
    );
  });

  it("words the notice resend texts neutrally, without voseo or a teacher", () => {
    expect(es.review.escalation.resend.result.enviada).toBe(
      "El aviso se envió a coordinación.",
    );
    expect(en.review.escalation.resend.result.enviada).toBe(
      "The notice was sent to the coordination.",
    );
    expect(JSON.stringify(es.review.escalation.resend)).not.toMatch(
      /\b(?:reenviá|tenés|podés|intentá|recargá|vos)\b/i,
    );
    expect(JSON.stringify(es.review.escalation.resend)).not.toMatch(/docente/i);
  });

  it("never words the student-facing or staff texts with the legacy voseo", () => {
    const spanish = JSON.stringify([es.review.escalation, es.review.report]);

    expect(spanish).not.toMatch(
      /\b(?:escribí|elegí|seleccioná|registrá|escalá|confirmá|tenés|podés|vos)\b/i,
    );
  });

  it("words no percentage or absence count anywhere in the report texts (RF-15 a)", () => {
    expect(JSON.stringify(es.review.report)).not.toMatch(/porcentaje/i);
    expect(JSON.stringify(en.review.report)).not.toMatch(/percent/i);
  });

  it("words the tabs neutrally in Spanish and in English", () => {
    expect(es.review.queue.tabs).toMatchObject({
      pendiente: "Pendientes",
      en_revision_coordinacion: "En coordinación",
      aprobada: "Aprobadas",
    });
    expect(en.review.queue.tabs).toMatchObject({
      pendiente: "Pending",
      en_revision_coordinacion: "In coordination",
      aprobada: "Approved",
    });
  });

  it.each(catalogs)("%s words the RN-19 special-format mark", (_l, m) => {
    const mark = m.review.decision.approve.specialFormat;

    expect(mark.label).toBeTruthy();
    expect(mark.hint).toBeTruthy();
  });
});

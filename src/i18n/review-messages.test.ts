import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { templateKey } from "@/app/(dashboard)/review/template-key";
import { DECISION_TEMPLATES } from "@/lib/intake/decision-templates";
import { ESCALATION_KINDS } from "@/lib/intake/escalation";
import { RETURN_REASONS } from "@/lib/intake/return-reasons";
import { REMISSION_REASONS, REMISSION_STATES } from "@/lib/remission/states";
import {
  NOT_EVALUABLE_REASONS,
  SIGNAL_CODES,
  VERDICTS,
} from "@/lib/signals/types";

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
        e.dialog.motivoLabel,
        e.dialog.motivo.sospecha_documento,
        e.dialog.motivo.caso_especial,
        e.dialog.noteLabel,
        e.dialog.noteHint,
        e.dialog.counter,
        e.dialog.confirm,
        e.dialog.pending,
        e.dialog.cancel,
        e.dialog.backToQueue,
        e.reasons.sospecha_documento,
        e.reasons.caso_especial,
        e.reasons.exceso_inasistencias,
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

  // E18: the exact Spanish the secretary reads when she picks the motive.
  it("words the escalation motive in neutral Spanish with usted", () => {
    const e = es.review.escalation;

    expect(e.dialog.motivoLabel).toBe("Motivo del escalamiento");
    expect(e.dialog.motivo).toEqual({
      sospecha_documento: "Sospecha sobre un documento",
      caso_especial: "Caso especial (fuera de las causas del reglamento)",
    });
    expect(e.errors.motivo_invalid).toBe(
      "Seleccione el motivo del escalamiento.",
    );
    expect(e.reasons.caso_especial).toBe("Caso especial");
    expect(JSON.stringify(e)).not.toMatch(/escalación/i);
  });

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

  it("words the escalate conflict for a lost race and for a wrong state alike", () => {
    // `conflict` is returned both when another action got there first and when
    // the request is approved, rejected or returned, so it names no cause.
    expect(es.review.escalation.errors.conflict).toBe(
      "Esta solicitud ya no está pendiente. Vuelva a la cola para ver su estado.",
    );
    expect(en.review.escalation.errors.conflict).toBe(
      "This request is no longer pending. Go back to the queue to see its status.",
    );
    expect(es.review.escalation.errors.conflict).not.toMatch(/escalada/);
    expect(en.review.escalation.errors.conflict).not.toMatch(/escalated/);
  });

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

describe("secretary guidance copy (usability session)", () => {
  it("tells the secretary the teachers are notified on approval", () => {
    expect(es.review.decision.approve.description).toContain(
      "Al aprobar, el sistema envía un aviso por correo a los docentes de las asignaturas; su estado se ve en «Aviso a los docentes» en esta misma página.",
    );
    expect(es.review.queue.result.aprobada).toContain("«Aviso a los docentes»");
    expect(en.review.queue.result.aprobada).toContain("“Notice to teachers”");
  });

  it("points to the escalation button from the decision panel by its label", () => {
    expect(es.review.detail.decisionPanel.description).toContain(
      `«${es.review.escalation.dialog.trigger}»`,
    );
    expect(en.review.detail.decisionPanel.description).toContain(
      `“${en.review.escalation.dialog.trigger}”`,
    );
  });
});

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
    expect(es.review.detail.sections.extraction).toBe(
      "Datos leídos del documento",
    );
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

describe("review signals messages (validation-signals, RNF-12)", () => {
  const keysOf = (m: typeof es) =>
    leaves(m.review.signals, "review.signals").map(([key]) => key);

  it("has the same review.signals keys in both locales", () => {
    expect(keysOf(es).length).toBeGreaterThan(20);
    expect(keysOf(en).sort()).toEqual(keysOf(es).sort());
  });

  it.each(catalogs)(
    "%s words the section, its sentence and the notice",
    (_l, m) => {
      const x = m.review.signals;

      for (const text of [x.title, x.note, x.degraded, x.verdict.line]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      expect(x.notEvaluable.title.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(catalogs)(
    "%s names every signal, outcome, verdict and reason",
    (_l, m) => {
      const x = m.review.signals as unknown as Record<
        string,
        Record<string, string>
      >;

      for (const signal of SIGNAL_CODES)
        expect(x.names[signal], signal).toBeTruthy();
      for (const outcome of [
        "present",
        "absent",
        "not_evaluable",
        "not_applicable",
      ]) {
        expect(x.outcomes[outcome], outcome).toBeTruthy();
      }
      expect(x.notApplicableNote, "notApplicableNote").toBeTruthy();
      for (const verdict of VERDICTS)
        expect(x.verdict[verdict], verdict).toBeTruthy();
      for (const reason of NOT_EVALUABLE_REASONS) {
        expect(x.reasons[reason], reason).toBeTruthy();
      }
    },
  );

  it("words the verdicts as «Revisar con cuidado», «Sin alertas» and «No concluyente»", () => {
    expect(es.review.signals.verdict.review_carefully).toBe(
      "Revisar con cuidado",
    );
    expect(es.review.signals.verdict.no_alerts).toBe("Sin alertas");
    expect(es.review.signals.verdict.inconclusive).toBe("No concluyente");
    expect(en.review.signals.verdict.review_carefully).toBe("Review carefully");
    expect(en.review.signals.verdict.no_alerts).toBe("No alerts");
    expect(en.review.signals.verdict.inconclusive).toBe("Inconclusive");
  });

  it("words not applicable as «No aplica» with its explanation line (RN-09, RN-10)", () => {
    expect(es.review.signals.outcomes.not_applicable).toBe("No aplica");
    expect(es.review.signals.notApplicableNote).toBe(
      "La causa declarada no incluye reposo.",
    );
    expect(en.review.signals.outcomes.not_applicable).toBe("Not applicable");
    expect(en.review.signals.notApplicableNote).toBe(
      "The declared cause does not include a rest period.",
    );
  });

  it("states in both locales that the suggestion does not change the request", () => {
    expect(es.review.signals.note).toMatch(
      /no cambia el estado de la solicitud/,
    );
    expect(en.review.signals.note).toMatch(
      /does not change the state of the request/,
    );
  });

  it("words the coordination note as support for the answer, without the secretary's decision", () => {
    expect(es.review.signals.coordinationNote).toBe(
      "Sugerencia automática para apoyar su respuesta; no cambia el estado de la solicitud.",
    );
    expect(en.review.signals.coordinationNote).toBe(
      "Automatic suggestion to support your answer; it does not change the state of the request.",
    );
    expect(es.review.signals.coordinationNote).not.toMatch(/decisi/i);
    expect(en.review.signals.coordinationNote).not.toMatch(/decision/i);
  });

  it("is neutral professional Spanish, with no voseo", () => {
    const text = leaves(es.review.signals)
      .map(([, value]) => String(value))
      .join(" ");

    expect(text).not.toMatch(
      /(vos|tenés|podés|querés|sabés|sos|mirá|revisá|fijate|hacé|verificá|contactá)/i,
    );
    expect(text).not.toMatch(/che/i);
  });

  it("keeps the evidence placeholders", () => {
    for (const m of [es, en]) {
      const e = m.review.signals.evidence;

      expect(e.timing).toContain("{presented}");
      expect(e.timing).toContain("{deadline}");
      for (const name of ["issued", "end"]) {
        expect(e.incoherent).toContain(`{${name}}`);
      }
      for (const name of ["issuer", "count", "threshold"]) {
        expect(e.recurrence).toContain(`{${name}}`);
      }
      for (const name of ["absence", "covered"]) {
        expect(e.uncovered).toContain(`{${name}}`);
      }
    }
  });

  it.each(catalogs)(
    "%s words RN-26: its name, the match line, the link and the missing fingerprint",
    (_l, m) => {
      const x = m.review.signals;

      expect(x.names.rn26.trim().length).toBeGreaterThan(0);
      expect(x.reasons.no_fingerprint.trim().length).toBeGreaterThan(0);
      expect(x.evidence.repeated.trim().length).toBeGreaterThan(0);
      expect(x.evidence.repeatedSee.trim().length).toBeGreaterThan(0);
      expect(x.evidence.requestLink).toContain("{id}");
    },
  );

  it("words RN-26 as «Documento repetido» and «Repeated document»", () => {
    expect(es.review.signals.names.rn26).toBe("Documento repetido");
    expect(en.review.signals.names.rn26).toBe("Repeated document");
  });

  it.each(catalogs)(
    "%s keeps the match text free of anything that says whose request it is or why no number shows",
    (_l, m) => {
      const text = [
        m.review.signals.evidence.repeated,
        m.review.signals.evidence.repeatedSee,
        m.review.signals.reasons.no_fingerprint,
      ].join(" ");

      expect(text).not.toMatch(
        /alcance|facultad|otro estudiante|mismo estudiante|scope|faculty|another student|same student|hash|huella|fingerprint/i,
      );
    },
  );
});

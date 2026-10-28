import { isIsoDate, managuaToday } from "./dates";

// Pure constants and validators of the escalation write paths (ES-1, ES-2,
// ES-6..ES-8). The schema CHECK lists are rendered from the arrays, so a value
// added here reaches the database only through a generated migration. The
// validators run before any transaction and never trust the client: a direct
// action call with an empty note or a foreign reason is refused here. Every
// problem is reported at once, in field order, each with a stable code the UI
// maps to an i18n message.

/** `Escalamiento.Tipo` (RN-20): a suspicion escalates, an excess notifies. */
export const ESCALATION_KINDS = [
  "sospecha_documento",
  "exceso_inasistencias",
] as const;

export type EscalationKind = (typeof ESCALATION_KINDS)[number];

/** The only reason a secretary escalation may carry; the server fixes it. */
export const ESCALATION_REASON: EscalationKind = "sospecha_documento";

/** The kind of the informational notice an RF-15 report creates. */
export const EXCESS_NOTICE_KIND: EscalationKind = "exceso_inasistencias";

/** The only request state an RF-15 excess report may be recorded on. */
export const EXCESS_REPORT_STATE = "aprobada";

/** Delivery state of the coordination notice (the escalation's own outbox). */
export const ESCALATION_NOTICE_STATES = [
  "pendiente",
  "enviada",
  "bloqueada",
] as const;

export type EscalationNoticeState = (typeof ESCALATION_NOTICE_STATES)[number];

export const ESCALATION_NOTICE_REASONS = [
  "sin_destinatarios",
  "error_envio",
] as const;

export type EscalationNoticeReason = (typeof ESCALATION_NOTICE_REASONS)[number];

/** Bound of an escalation note, a coordinator answer and a report note. */
export const ESCALATION_NOTE_MAX = 1000;

export type EscalationField =
  "motivo" | "nota" | "texto" | "comunicadoEl" | "docente";

export type EscalationErrorCode =
  | "motivo_invalid"
  | "nota_required"
  | "nota_blank"
  | "nota_too_long"
  | "texto_required"
  | "texto_too_long"
  | "date_invalid"
  | "date_future"
  | "docente_invalid";

export interface EscalationError {
  field: EscalationField;
  code: EscalationErrorCode;
}

type Invalid = { ok: false; errors: EscalationError[] };

/** A required text of 1 to `ESCALATION_NOTE_MAX` trimmed characters. */
function requiredText(
  value: unknown,
  field: "nota" | "texto",
): { text: string } | { error: EscalationError } {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0) {
    return {
      error: {
        field,
        code: field === "nota" ? "nota_required" : "texto_required",
      },
    };
  }
  if (text.length > ESCALATION_NOTE_MAX) {
    return {
      error: {
        field,
        code: field === "nota" ? "nota_too_long" : "texto_too_long",
      },
    };
  }
  return { text };
}

/** RN-20: the reason is fixed by the server and the note is mandatory. */
export function validateEscalationDraft(input: {
  motivo: unknown;
  nota: unknown;
}): { ok: true; motivo: EscalationKind; nota: string } | Invalid {
  const errors: EscalationError[] = [];
  if (input.motivo !== ESCALATION_REASON) {
    errors.push({ field: "motivo", code: "motivo_invalid" });
  }
  const note = requiredText(input.nota, "nota");
  if ("error" in note) errors.push(note.error);
  if (errors.length > 0 || "error" in note) return { ok: false, errors };
  return { ok: true, motivo: ESCALATION_REASON, nota: note.text };
}

/** ES-8: the coordinator answer, 1 to 1000 trimmed characters. */
export function validateAnswerText(
  texto: unknown,
): { ok: true; texto: string } | Invalid {
  const answer = requiredText(texto, "texto");
  return "error" in answer
    ? { ok: false, errors: [answer.error] }
    : { ok: true, texto: answer.text };
}

/**
 * RF-15: a calendar date not later than today in Managua (no lower bound) and
 * an optional note. A missing, `null` or empty note is absent; a given note
 * must be non-blank and at most 1000 trimmed characters.
 */
export function validateReportDraft(
  input: { comunicadoEl: unknown; nota?: unknown },
  now: Date,
): { ok: true; comunicadoEl: string; nota: string | null } | Invalid {
  const errors: EscalationError[] = [];
  const date = input.comunicadoEl;
  if (!isIsoDate(date)) {
    errors.push({ field: "comunicadoEl", code: "date_invalid" });
  } else if (date > managuaToday(now)) {
    errors.push({ field: "comunicadoEl", code: "date_future" });
  }

  let nota: string | null = null;
  const given = input.nota;
  if (given !== undefined && given !== null && given !== "") {
    const trimmed = typeof given === "string" ? given.trim() : "";
    if (trimmed.length === 0) {
      errors.push({ field: "nota", code: "nota_blank" });
    } else if (trimmed.length > ESCALATION_NOTE_MAX) {
      errors.push({ field: "nota", code: "nota_too_long" });
    } else {
      nota = trimmed;
    }
  }

  if (errors.length > 0 || !isIsoDate(date)) return { ok: false, errors };
  return { ok: true, comunicadoEl: date, nota };
}

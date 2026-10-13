import { getTemplate, type DecisionKind } from "./decision-templates";
import { isReturnReason, type ReturnReason } from "./return-reasons";

// Server-side validation of a secretary decision (SR-7, RF-07, RN-17, RNF-12).
// Pure: it runs before the decision transaction and never trusts the client, so
// a direct action call with empty reject text is refused here. Every problem is
// reported at once, in field order, each with a stable code the UI maps to an
// i18n message.

export const DECISION_TEXT_MAX = 1000;

/** Untrusted input as it arrives from the action. */
export interface DecisionDraft {
  tipo: string;
  plantilla: string;
  motivo?: string | null;
  texto: string | null;
}

/** A validated decision; `texto` is trimmed (and `null` for a blank approval). */
export type DecisionInput =
  | { tipo: "aprobada"; plantilla: string; texto: string | null }
  | { tipo: "rechazada"; plantilla: string; texto: string }
  | {
      tipo: "devuelta";
      plantilla: string;
      motivo: ReturnReason;
      texto: string;
    };

export type DecisionField = "tipo" | "plantilla" | "motivo" | "texto";

export type DecisionErrorCode =
  | "tipo_invalid"
  | "template_unknown"
  | "template_mismatch"
  | "motivo_required"
  | "motivo_invalid"
  | "motivo_not_allowed"
  | "text_required"
  | "text_too_long"
  | "text_placeholder";

export interface DecisionError {
  field: DecisionField;
  code: DecisionErrorCode;
}

export type DecisionResult =
  | { ok: true; decision: DecisionInput }
  | { ok: false; errors: DecisionError[] };

const KINDS: readonly string[] = ["aprobada", "rechazada", "devuelta"];

/** An unresolved template marker such as `[indique el motivo]`. */
const UNRESOLVED_MARKER = /\[[^\]]*\]/;

function isKind(value: string): value is DecisionKind {
  return KINDS.includes(value);
}

function templateErrors(
  tipo: DecisionKind,
  plantilla: string,
  motivo: ReturnReason | null,
): DecisionError[] {
  const template = getTemplate(plantilla);
  if (!template) return [{ field: "plantilla", code: "template_unknown" }];
  const kindMatches = template.tipo === tipo;
  const reasonMatches =
    tipo !== "devuelta" || motivo === null || template.motivo === motivo;
  return kindMatches && reasonMatches
    ? []
    : [{ field: "plantilla", code: "template_mismatch" }];
}

function reasonErrors(
  tipo: DecisionKind,
  motivo: string | null | undefined,
): DecisionError[] {
  const given = motivo !== null && motivo !== undefined && motivo !== "";
  if (tipo !== "devuelta") {
    return given ? [{ field: "motivo", code: "motivo_not_allowed" }] : [];
  }
  if (!given) return [{ field: "motivo", code: "motivo_required" }];
  return isReturnReason(motivo)
    ? []
    : [{ field: "motivo", code: "motivo_invalid" }];
}

function textErrors(tipo: DecisionKind, texto: string): DecisionError[] {
  if (texto.length === 0) {
    return tipo === "aprobada"
      ? []
      : [{ field: "texto", code: "text_required" }];
  }
  if (texto.length > DECISION_TEXT_MAX) {
    return [{ field: "texto", code: "text_too_long" }];
  }
  return tipo === "rechazada" && UNRESOLVED_MARKER.test(texto)
    ? [{ field: "texto", code: "text_placeholder" }]
    : [];
}

export function validateDecision(input: DecisionDraft): DecisionResult {
  if (!isKind(input.tipo)) {
    return { ok: false, errors: [{ field: "tipo", code: "tipo_invalid" }] };
  }
  const tipo = input.tipo;
  const texto = (input.texto ?? "").trim();
  const motivo = isReturnReason(input.motivo) ? input.motivo : null;

  const errors = [
    ...templateErrors(tipo, input.plantilla, motivo),
    ...reasonErrors(tipo, input.motivo),
    ...textErrors(tipo, texto),
  ];
  if (errors.length > 0) return { ok: false, errors };

  if (tipo === "devuelta" && motivo !== null) {
    return {
      ok: true,
      decision: { tipo, plantilla: input.plantilla, motivo, texto },
    };
  }
  if (tipo === "aprobada") {
    return {
      ok: true,
      decision: {
        tipo,
        plantilla: input.plantilla,
        texto: texto === "" ? null : texto,
      },
    };
  }
  return {
    ok: true,
    decision: { tipo: "rechazada", plantilla: input.plantilla, texto },
  };
}

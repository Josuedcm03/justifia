import type { Causa } from "./causes";
import type { ReturnReason } from "./return-reasons";

// Predefined decision messages (SR-8, RF-07). Code constants, in Spanish: the
// stored text is institutional and must not depend on the reviewer's locale (the
// UI labels of the templates live in i18n). The register follows the real
// institutional notices. The secretary edits the rendered text before
// confirming; audit carries only the template code, never the text.

/** The three decisions a secretary may take; the schema CHECK derives from it. */
export const DECISION_KINDS = ["aprobada", "rechazada", "devuelta"] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

export interface DecisionTemplate {
  codigo: string;
  tipo: DecisionKind;
  /** Set for return templates: the RN-17 reason that selects the template. */
  motivo?: ReturnReason;
  cuerpo: string;
}

export interface TemplateVars {
  estudiante: string;
  causa: Causa;
  /** Managua `YYYY-MM-DD`. */
  fechaInicio: string;
  fechaFin: string;
}

/** The only placeholders a template may use. */
export const PLACEHOLDERS = ["{estudiante}", "{causa}", "{fechas}"] as const;

/** Spanish phrase for "por motivos {causa}" (a pure function of the code). */
export const CAUSE_PHRASES: Record<Causa, string> = {
  maternidad_paternidad: "de maternidad, paternidad o lactancia",
  actividad_representativa:
    "de actividad cultural o deportiva en representación de la universidad",
  intercambio_academico: "de intercambio académico",
  medica: "médicos",
  fuerza_mayor: "de fuerza mayor",
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parts(iso: string): { year: number; month: string; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: MONTHS[month - 1], day };
}

/** "el día 3 de marzo de 2026" for one day, "del 3 al 5 de marzo de 2026" else. */
export function formatDateRange(start: string, end: string): string {
  const from = parts(start);
  const to = parts(end);
  if (start === end)
    return `el día ${from.day} de ${from.month} de ${from.year}`;
  if (from.year === to.year && from.month === to.month) {
    return `del ${from.day} al ${to.day} de ${to.month} de ${to.year}`;
  }
  if (from.year === to.year) {
    return `del ${from.day} de ${from.month} al ${to.day} de ${to.month} de ${to.year}`;
  }
  return `del ${from.day} de ${from.month} de ${from.year} al ${to.day} de ${to.month} de ${to.year}`;
}

const LEAD =
  "Buenos días, {estudiante}. Su solicitud de justificación de la inasistencia por motivos {causa} {fechas}";

// What joins the introduction of a rejection to its reason. The templates below
// and `withoutRejectionIntro` share them, so they cannot drift apart.
const REJECTED = " no ha sido aprobada ";
const REASON_FOLLOWS = "por el siguiente motivo: ";
const BECAUSE = "porque ";

export const DECISION_TEMPLATES: readonly DecisionTemplate[] = [
  {
    codigo: "aprobacion.general",
    tipo: "aprobada",
    cuerpo: `${LEAD} ha sido aprobada. Gracias por su atención.`,
  },
  {
    codigo: "rechazo.general",
    tipo: "rechazada",
    cuerpo: `${LEAD}${REJECTED}${REASON_FOLLOWS}[indique el motivo]. Gracias por su atención.`,
  },
  {
    codigo: "rechazo.documento_no_acredita",
    tipo: "rechazada",
    cuerpo: `${LEAD}${REJECTED}${BECAUSE}el documento de respaldo no acredita la inasistencia en las fechas indicadas. Gracias por su atención.`,
  },
  {
    codigo: "devolucion.fecha_incorrecta",
    tipo: "devuelta",
    motivo: "fecha_incorrecta",
    cuerpo: `${LEAD} fue devuelta para corrección: la fecha registrada no coincide con la del documento de respaldo. Le solicitamos corregirla y reenviar la solicitud. Gracias de antemano.`,
  },
  {
    codigo: "devolucion.fecha_alterada",
    tipo: "devuelta",
    motivo: "fecha_alterada",
    cuerpo: `${LEAD} fue devuelta para corrección: la fecha del documento de respaldo presenta alteraciones. Le solicitamos adjuntar un documento sin alteraciones y reenviar la solicitud. Gracias de antemano.`,
  },
  {
    codigo: "devolucion.documento_ilegible",
    tipo: "devuelta",
    motivo: "documento_ilegible",
    cuerpo: `${LEAD} fue devuelta para corrección: el documento de respaldo no es legible. Le solicitamos adjuntar una copia legible y reenviar la solicitud. Gracias de antemano.`,
  },
];

// The introduction of a rejection: any value in the place of a placeholder, up
// to the first words that open a reason.
const REJECTION_INTRO = new RegExp(
  `^${(LEAD + REJECTED).replace(/[.]/g, "[.]").replace(/{[^}]*}/g, ".+?")}(?:${REASON_FOLLOWS}|${BECAUSE})`,
);

/**
 * A rejection text from its reason on, without the fixed introduction of the
 * templates (FE-15): the request card has room for an excerpt only. A text that
 * does not open with that introduction, or has nothing after it, comes back as
 * it is.
 */
export function withoutRejectionIntro(text: string): string {
  const trimmed = text.trim();
  const intro = REJECTION_INTRO.exec(trimmed)?.[0];
  return intro === undefined ? text : trimmed.slice(intro.length) || text;
}

export function getTemplate(codigo: string): DecisionTemplate | undefined {
  return DECISION_TEMPLATES.find((t) => t.codigo === codigo);
}

export function templatesFor(tipo: DecisionKind): DecisionTemplate[] {
  return DECISION_TEMPLATES.filter((t) => t.tipo === tipo);
}

/** Choosing the RN-17 reason selects its return template. */
export function templateForReason(motivo: ReturnReason): DecisionTemplate {
  const found = DECISION_TEMPLATES.find((t) => t.motivo === motivo);
  if (!found) throw new Error(`No return template for reason ${motivo}`);
  return found;
}

export function renderTemplate(codigo: string, vars: TemplateVars): string {
  const template = getTemplate(codigo);
  if (!template) throw new Error(`Unknown decision template ${codigo}`);
  const values: Record<string, string> = {
    "{estudiante}": vars.estudiante,
    "{causa}": CAUSE_PHRASES[vars.causa],
    "{fechas}": formatDateRange(vars.fechaInicio, vars.fechaFin),
  };
  // Single pass: a value is never re-scanned for placeholders.
  return template.cuerpo.replace(
    /\{[^}]*\}/g,
    (found) => values[found] ?? found,
  );
}

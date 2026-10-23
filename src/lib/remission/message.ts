import type { RevisionClase } from "@/db/schema";
import type { Causa } from "@/lib/intake/causes";
import {
  CAUSE_PHRASES,
  formatDateRange,
} from "@/lib/intake/decision-templates";
import { oneLine } from "@/lib/mail/one-line";

// Pure Spanish message of one remission (RF-09 a, RN-18, TR-10). The wording is
// institutional and independent of the reviewer's UI locale (as SR-8). Plain
// text only: names are data, never markup.

/** RN-18, always present. Owner-approved 2026-10-19 (TR-10). */
export const RN18_WARNING =
  "Esta justificación habilita la reprogramación de las evaluaciones o actividades de las fechas indicadas; no elimina la inasistencia del registro.";

/** RN-18 for force majeure only. Owner-approved 2026-10-19 (TR-10). */
export const RN18_DISCRETION_NOTE =
  "Por tratarse de una causa de fuerza mayor, la aplicación de penalizaciones en las evaluaciones reprogramadas queda a criterio del docente.";

export type RemissionMessageInput = {
  /** Teacher email recorded at approval. */
  to: string;
  /** Student email recorded at submission. */
  cc: string;
  estudianteNombre: string;
  estudianteCif: string;
  causa: Causa;
  /** Managua `YYYY-MM-DD`. */
  fechaInicio: string;
  fechaFin: string;
  /** Only this teacher's groups. */
  clases: readonly RevisionClase[];
  /** Original names of the attached files. */
  adjuntos: readonly string[];
};

export type RemissionDraft = {
  to: string;
  cc: string[];
  subject: string;
  text: string;
};

function classLine(clase: RevisionClase): string {
  return `- ${oneLine(clase.codigo)} ${oneLine(clase.nombre)}, grupo ${oneLine(clase.numeroGrupo)}`;
}

export function buildRemissionMessage(
  input: RemissionMessageInput,
): RemissionDraft {
  const estudiante = oneLine(input.estudianteNombre);
  const fechas = formatDateRange(input.fechaInicio, input.fechaFin);
  const warning =
    input.causa === "fuerza_mayor"
      ? `${RN18_WARNING} ${RN18_DISCRETION_NOTE}`
      : RN18_WARNING;

  const lines = [
    `Buenos días, su apoyo en justificar la inasistencia de ${estudiante} por motivos ${CAUSE_PHRASES[input.causa]}, ${fechas}.`,
    "",
    `Estudiante: ${estudiante} (CIF ${oneLine(input.estudianteCif)})`,
    "",
    "Asignaturas y grupos a su cargo:",
    ...input.clases.map(classLine),
    "",
    "Documentos adjuntos:",
    ...input.adjuntos.map((name) => `- ${oneLine(name)}`),
    "",
    warning,
    "",
    "Gracias de antemano.",
  ];

  return {
    to: input.to,
    cc: [input.cc],
    subject: `Justificar la inasistencia de ${estudiante}`,
    text: lines.join("\n"),
  };
}

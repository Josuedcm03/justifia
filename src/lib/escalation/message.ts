import type { EscalationKind } from "@/lib/intake/escalation";
import { oneLine } from "@/lib/mail/one-line";

// Pure Spanish message of one coordination notice (RF-10 b, ES-10, E6). The
// wording is institutional and independent of the reviewer's UI locale (as the
// remission message). Plain text only. It carries the minimum to find the
// request and the link to it: never the cause, dates, a teacher name, document
// names, attachments or the coordination's answer (RNF-02). The link needs a
// session of an authorized coordinator and holds no token.

export const REASON_LABELS: Record<EscalationKind, string> = {
  sospecha_documento: "Sospecha sobre un documento",
  exceso_inasistencias: "Exceso de inasistencias",
};

const SUBJECTS: Record<EscalationKind, (solicitudId: number) => string> = {
  sospecha_documento: (id) =>
    `Justifia: solicitud ${id} escalada a coordinación`,
  exceso_inasistencias: (id) => `Justifia: aviso sobre la solicitud ${id}`,
};

const INTROS: Record<EscalationKind, string> = {
  sospecha_documento:
    "La secretaría escaló a coordinación una solicitud de justificación para su revisión.",
  exceso_inasistencias:
    "La secretaría registró un aviso informativo sobre una solicitud de justificación aprobada.",
};

export type EscalationMessageInput = {
  /** First recipient; the others go in copy. */
  to: string;
  cc: readonly string[];
  solicitudId: number;
  escalamientoId: number;
  tipo: EscalationKind;
  estudianteNombre: string;
  estudianteCif: string;
  carreraNombre: string;
  /** The escalation note (suspicion) or the report note (excess), when any. */
  nota: string | null;
  /** Absolute origin of the app, e.g. `https://justifia.example.edu`. */
  baseUrl: string;
};

export type EscalationDraft = {
  to: string;
  cc: string[];
  subject: string;
  text: string;
};

export function buildEscalationMessage(
  input: EscalationMessageInput,
): EscalationDraft {
  const link = `${input.baseUrl.replace(/\/+$/, "")}/coordination/${input.escalamientoId}`;
  const lines = [
    "Estimada coordinación:",
    "",
    INTROS[input.tipo],
    "",
    `Solicitud: ${input.solicitudId}`,
    `Estudiante: ${oneLine(input.estudianteNombre)} (CIF ${oneLine(input.estudianteCif)})`,
    `Carrera: ${oneLine(input.carreraNombre)}`,
    `Motivo: ${REASON_LABELS[input.tipo]}`,
    ...(input.nota ? [`Nota: ${oneLine(input.nota)}`] : []),
    "",
    `Para consultarla, inicie sesión en el sistema y abra: ${link}`,
    "",
    "Atentamente,",
    "Secretaría Académica",
  ];

  return {
    to: input.to,
    cc: [...input.cc],
    subject: SUBJECTS[input.tipo](input.solicitudId),
    text: lines.join("\n"),
  };
}

import { brandLogoAttachment } from "@/lib/escalation/brand";
import { renderEscalationHtml } from "@/lib/escalation/html";
import type { EscalationKind } from "@/lib/intake/escalation";
import type { MailAttachment } from "@/lib/intake/ports";
import { oneLine } from "@/lib/mail/one-line";

// Pure Spanish message of one coordination notice (RF-10 b, ES-10, E6, E18). The
// wording is institutional and independent of the reviewer's UI locale (as the
// remission message). Multipart: the plain text is the fallback and the HTML
// part (`html.ts`) carries the same fields under the identity of the UAM and
// its Faculty. It carries the minimum to find the request and the link to it:
// never the cause, dates, a teacher name, document names, document attachments
// or the coordination's answer (RNF-02). The only attachment is the inline brand
// image, which is not a document and holds no personal data. The link needs a
// session of an authorized coordinator and holds no token.

export const REASON_LABELS: Record<EscalationKind, string> = {
  sospecha_documento: "Sospecha sobre un documento",
  caso_especial: "Caso especial",
  exceso_inasistencias: "Exceso de inasistencias",
};

const ESCALATION_SUBJECT = (solicitudId: number) =>
  `Justifia: solicitud ${solicitudId} escalada a coordinación`;

const SUBJECTS: Record<EscalationKind, (solicitudId: number) => string> = {
  sospecha_documento: ESCALATION_SUBJECT,
  caso_especial: ESCALATION_SUBJECT,
  exceso_inasistencias: (id) => `Justifia: aviso sobre la solicitud ${id}`,
};

const ESCALATION_INTRO =
  "La secretaría escaló a coordinación una solicitud de justificación para su revisión.";

const INTROS: Record<EscalationKind, string> = {
  sospecha_documento: ESCALATION_INTRO,
  caso_especial: ESCALATION_INTRO,
  exceso_inasistencias:
    "La secretaría registró un aviso informativo sobre una solicitud de justificación aprobada.",
};

/** Title bar of the HTML part: an escalation asks for a review, a notice informs. */
const HTML_TITLES: Record<EscalationKind, string> = {
  sospecha_documento: "Solicitud escalada a coordinación",
  caso_especial: "Solicitud escalada a coordinación",
  exceso_inasistencias: "Aviso de exceso de inasistencias",
};

const HTML_BUTTONS: Record<EscalationKind, string> = {
  sospecha_documento: "Revisar solicitud",
  caso_especial: "Revisar solicitud",
  exceso_inasistencias: "Ver aviso",
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
  /** The escalation note (either motive) or the report note (excess), when any. */
  nota: string | null;
  /** Absolute origin of the app, e.g. `https://justifia.example.edu`. */
  baseUrl: string;
};

export type EscalationDraft = {
  to: string;
  cc: string[];
  subject: string;
  text: string;
  /** The same notice as HTML, for the clients that render it. */
  html: string;
  /** The inline brand image the HTML references by content id. */
  attachments: MailAttachment[];
};

export function buildEscalationMessage(
  input: EscalationMessageInput,
): EscalationDraft {
  const link = `${input.baseUrl.replace(/\/+$/, "")}/coordination/${input.escalamientoId}`;
  // The same values feed the text and the HTML, so the two parts cannot drift.
  const fields = [
    { label: "Solicitud", value: String(input.solicitudId) },
    {
      label: "Estudiante",
      value: `${oneLine(input.estudianteNombre)} (CIF ${oneLine(input.estudianteCif)})`,
    },
    { label: "Carrera", value: oneLine(input.carreraNombre) },
    { label: "Motivo", value: REASON_LABELS[input.tipo] },
    ...(input.nota ? [{ label: "Nota", value: oneLine(input.nota) }] : []),
  ];
  const lines = [
    "Estimada coordinación:",
    "",
    INTROS[input.tipo],
    "",
    ...fields.map((f) => `${f.label}: ${f.value}`),
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
    html: renderEscalationHtml({
      title: HTML_TITLES[input.tipo],
      intro: INTROS[input.tipo],
      rows: fields,
      buttonLabel: HTML_BUTTONS[input.tipo],
      link,
    }),
    attachments: [brandLogoAttachment()],
  };
}

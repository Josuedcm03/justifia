import { createHash } from "node:crypto";

import type { RevisionClase } from "@/db/schema";
import type { Causa } from "@/lib/intake/causes";

import { exceedsAttachmentLimit } from "./limits";
import { buildRemissionMessage, type RemissionDraft } from "./message";
import type { RemissionReason } from "./states";

// Pure plan of one remission send (TR-6, TR-7, RN-19): blockers in gate order,
// otherwise the message, the documents to attach and the provider idempotency
// key. No I/O: the dispatcher loads bytes and calls the mail port.

export type PlanDocument = {
  id: number;
  nombreOriginal: string;
  tipoDetectado: "pdf" | "png" | "jpeg";
  tamanoBytes: number;
  /** Null = uploaded by the student; set = staff upload (TR-16). */
  subidoPorId: number | null;
  formatoEspecial: boolean;
};

export type PlanInput = {
  remisionId: number;
  /** Email to send to, already refreshed by the dispatcher when applicable. */
  correo: string | null;
  clases: readonly RevisionClase[];
  solicitud: {
    causa: Causa;
    fechaInicio: string;
    fechaFin: string;
    estudianteNombre: string;
    estudianteCif: string;
    estudianteCorreo: string;
    formatoEspecial: boolean;
  };
  /** The request's current valid documents. */
  documentos: readonly PlanDocument[];
};

export type PlanBlocker = Extract<
  RemissionReason,
  "sin_correo" | "formato_especial_faltante" | "adjuntos_exceden_limite"
>;

export type RemissionPlan =
  | { kind: "blocked"; motivo: PlanBlocker }
  | {
      kind: "send";
      draft: RemissionDraft;
      documentIds: number[];
      idempotencyKey: string;
    };

/**
 * Marked request: only the staff-uploaded format. Unmarked: only the student's
 * own documents; a staff upload is never among them (RN-19).
 */
function selectDocuments(input: PlanInput): PlanDocument[] {
  const chosen = input.solicitud.formatoEspecial
    ? input.documentos.filter((d) => d.formatoEspecial)
    : input.documentos.filter((d) => d.subidoPorId === null);
  return [...chosen].sort((a, b) => a.id - b.id);
}

/**
 * Provider idempotency key (TR-6): stable for an equal payload, new when the
 * recipient, the copy or the attachments change.
 */
function idempotencyKey(
  remisionId: number,
  draft: RemissionDraft,
  documents: readonly PlanDocument[],
): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        to: draft.to,
        cc: draft.cc,
        attachments: documents.map((d) => [d.id, d.tamanoBytes]),
      }),
    )
    .digest("hex")
    .slice(0, 16);
  return `remision-${remisionId}-${digest}`;
}

export function planRemission(input: PlanInput): RemissionPlan {
  const correo = input.correo?.trim();
  if (!correo) return { kind: "blocked", motivo: "sin_correo" };

  const documents = selectDocuments(input);
  if (input.solicitud.formatoEspecial && documents.length === 0) {
    return { kind: "blocked", motivo: "formato_especial_faltante" };
  }
  if (exceedsAttachmentLimit(documents.map((d) => d.tamanoBytes))) {
    return { kind: "blocked", motivo: "adjuntos_exceden_limite" };
  }

  const draft = buildRemissionMessage({
    to: correo,
    cc: input.solicitud.estudianteCorreo,
    estudianteNombre: input.solicitud.estudianteNombre,
    estudianteCif: input.solicitud.estudianteCif,
    causa: input.solicitud.causa,
    fechaInicio: input.solicitud.fechaInicio,
    fechaFin: input.solicitud.fechaFin,
    clases: input.clases,
    adjuntos: documents.map((d) => d.nombreOriginal),
  });

  return {
    kind: "send",
    draft,
    documentIds: documents.map((d) => d.id),
    idempotencyKey: idempotencyKey(input.remisionId, draft, documents),
  };
}

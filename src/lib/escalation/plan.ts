import type { EscalationKind } from "@/lib/intake/escalation";
import { mailIdempotencyKey } from "@/lib/mail/idempotency-key";

import { buildEscalationMessage, type EscalationDraft } from "./message";

// Pure plan of one coordination notice (ES-10, E4): the recipients decide first
// (nobody to tell is a visible blocked state, whatever the mail configuration
// is), then the mail configuration, otherwise the one message and its provider
// idempotency key. One message with the first recipient in `to` and the rest in
// `cc`, so "every recipient accepted" is one provider acceptance. No I/O.

export type PlanInput = {
  escalamientoId: number;
  solicitudId: number;
  tipo: EscalationKind;
  nota: string | null;
  estudianteNombre: string;
  estudianteCif: string;
  carreraNombre: string;
  /** Emails resolved fresh for this attempt, in a stable order. */
  recipients: readonly string[];
  /** `APP_BASE_URL`; unset leaves the notice `pendiente`. */
  baseUrl: string | undefined;
};

export type EscalationPlan =
  | { kind: "blocked"; motivo: "sin_destinatarios" }
  | { kind: "not_configured" }
  | {
      kind: "send";
      draft: EscalationDraft;
      idempotencyKey: string;
      destinatarios: number;
    };

export function planEscalationNotice(input: PlanInput): EscalationPlan {
  const recipients = input.recipients
    .map((email) => email.trim())
    .filter((email) => email !== "");
  if (recipients.length === 0) {
    return { kind: "blocked", motivo: "sin_destinatarios" };
  }
  if (!input.baseUrl) return { kind: "not_configured" };

  const [to, ...cc] = recipients;
  const draft = buildEscalationMessage({
    to,
    cc,
    solicitudId: input.solicitudId,
    escalamientoId: input.escalamientoId,
    tipo: input.tipo,
    estudianteNombre: input.estudianteNombre,
    estudianteCif: input.estudianteCif,
    carreraNombre: input.carreraNombre,
    nota: input.nota,
    baseUrl: input.baseUrl,
  });
  return {
    kind: "send",
    draft,
    idempotencyKey: mailIdempotencyKey("escalamiento", input.escalamientoId, {
      to: draft.to,
      cc: draft.cc,
    }),
    destinatarios: recipients.length,
  };
}

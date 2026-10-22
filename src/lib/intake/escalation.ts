// Pure constants of the escalation tables (ES-1, ES-2). The schema CHECK lists
// are rendered from these arrays, so a value added here reaches the database
// only through a generated migration. The validators join this file in the
// write-path unit.

/** `Escalamiento.Tipo` (RN-20): a suspicion escalates, an excess notifies. */
export const ESCALATION_KINDS = [
  "sospecha_documento",
  "exceso_inasistencias",
] as const;

export type EscalationKind = (typeof ESCALATION_KINDS)[number];

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

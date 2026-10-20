// Pure constants of the teacher-remission outbox (TR-2). The schema CHECK
// lists are rendered from these arrays, so a value added here reaches the
// database only through a generated migration.

export const REMISSION_STATES = ["pendiente", "enviada", "bloqueada"] as const;

export type RemissionState = (typeof REMISSION_STATES)[number];

export const REMISSION_REASONS = [
  "sin_correo",
  "formato_especial_faltante",
  "adjuntos_exceden_limite",
  "error_envio",
] as const;

export type RemissionReason = (typeof REMISSION_REASONS)[number];

export const REMISSION_TRIGGERS = [
  "aprobacion",
  "reenvio_manual",
  "reintento_automatico",
  "formato_especial",
] as const;

export type RemissionTrigger = (typeof REMISSION_TRIGGERS)[number];

export function isRemissionState(value: unknown): value is RemissionState {
  return (REMISSION_STATES as readonly unknown[]).includes(value);
}

export function isRemissionReason(value: unknown): value is RemissionReason {
  return (REMISSION_REASONS as readonly unknown[]).includes(value);
}

/**
 * Source states a dispatch trigger may claim. `enviada` is terminal and is in
 * none of them. Only a secretary's manual resend may pick up a `bloqueada`
 * remission (for example after fixing a teacher email).
 */
export function claimableStates(
  trigger: RemissionTrigger,
): readonly RemissionState[] {
  return trigger === "reenvio_manual"
    ? ["pendiente", "bloqueada"]
    : ["pendiente"];
}

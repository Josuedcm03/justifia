// The closed list of return reasons of RN-17. A returned request carries exactly
// one code. Codes fit the `SolicitudDecision.MotivoCodigo` varchar(30) column;
// the UI label of each code lives in i18n and the schema CHECK is derived from
// this list, so the two cannot drift.
export const RETURN_REASONS = [
  "fecha_incorrecta",
  "fecha_alterada",
  "documento_ilegible",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export function isReturnReason(value: unknown): value is ReturnReason {
  return (
    typeof value === "string" &&
    (RETURN_REASONS as readonly string[]).includes(value)
  );
}

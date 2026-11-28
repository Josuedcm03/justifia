// The five absence causes of RN-01 (D4: code constants, not configuration).
// Codes fit the `Solicitud.Causa` varchar(30) column; the UI label of each code
// lives in i18n (`intake.causes.*`). `src/db/schema.ts` derives its CHECK from
// this list, so the two cannot drift.
export const CAUSAS = [
  // Maternity, paternity or breastfeeding.
  "maternidad_paternidad",
  // Cultural or sports activities representing the university.
  "actividad_representativa",
  "intercambio_academico",
  "medica",
  // Other force majeure.
  "fuerza_mayor",
] as const;

export type Causa = (typeof CAUSAS)[number];

export function isCausa(value: unknown): value is Causa {
  return (
    typeof value === "string" && (CAUSAS as readonly string[]).includes(value)
  );
}

/** The errors a chosen cause can carry once it is present (RN-01, NP-11). */
export type CauseErrorCode = "causa_invalid" | "causa_inactive";

/**
 * The error of a present cause code, or none: a code outside the five is
 * invalid, one of the five that is not among `selectable` is inactive. A draft
 * passes the active causes; a correction passes all five (A14).
 */
export function causeErrors(
  causa: string,
  selectable: readonly Causa[],
): CauseErrorCode[] {
  if (!isCausa(causa)) return ["causa_invalid"];
  return selectable.includes(causa) ? [] : ["causa_inactive"];
}

// Causes whose document can grant a rest period (RN-09, RN-10 only apply to
// them). Another code constant, not configuration: the configurable cause to
// document table is RNF-14 (change normative-parameters); the type to cause map
// that RN-13 reads lives in `src/lib/signals/document-type-causes.ts`.
export const CAUSAS_CON_REPOSO = [
  "medica",
  "maternidad_paternidad",
] as const satisfies readonly Causa[];

export function admitsRest(causa: Causa): boolean {
  return (CAUSAS_CON_REPOSO as readonly Causa[]).includes(causa);
}

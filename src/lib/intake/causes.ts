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

// Causes whose document can grant a rest period (RN-09, RN-10 only apply to
// them). Another code constant, not configuration: the configurable cause to
// document table is RNF-14 (change normative-parameters).
export const CAUSAS_CON_REPOSO = [
  "medica",
  "maternidad_paternidad",
] as const satisfies readonly Causa[];

export function admitsRest(causa: Causa): boolean {
  return (CAUSAS_CON_REPOSO as readonly Causa[]).includes(causa);
}

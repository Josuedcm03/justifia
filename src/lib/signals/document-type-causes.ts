import type { TipoDocumento } from "@/lib/document-data/types";
import type { Causa } from "@/lib/intake/causes";

// The causes each document type corresponds to (manual-document-data, D4,
// MD-15). It is an input of the RN-13 evaluator through `SignalParams`, so
// replacing this constant with the configurable table of roadmap row 8
// (RNF-14, still "not met") changes no evaluator. Pure, with no "server-only".
//
// - constancia_medica: a medical certificate. Pairing it with the maternity or
//   paternity cause is an assumption of the design; no thesis scenario
//   decides it.
// - constancia_institucional: an institutional certificate, for the causes
//   that are not health related.
// - otro: corresponds to no cause, so it always raises the RN-13 signal.
export const DOCUMENT_TYPE_CAUSES = {
  constancia_medica: ["medica", "maternidad_paternidad"],
  constancia_institucional: [
    "actividad_representativa",
    "intercambio_academico",
    "fuerza_mayor",
  ],
  otro: [],
} as const satisfies Readonly<Record<TipoDocumento, readonly Causa[]>>;

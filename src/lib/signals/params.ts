import type { DocumentTypeCauses } from "./document-marks";
import { DOCUMENT_TYPE_CAUSES } from "./document-type-causes";

// Evaluation parameters (RN-13, RN-14, RNF-14). The recurrence threshold and the
// type-to-cause map are inputs of the evaluation, never read inside an
// evaluator. The values in force come from the normative parameters, loaded when
// the signals are read (`loadSignals`); this module only holds the shape and the
// Reglamento defaults, which the parameter registry points at as its own
// defaults for these two keys. The shape and the values are read by other
// modules (the coordination report): keep both stable.

export type SignalParams = {
  /** Requests of one student, period and issuer at which RN-14 is present. */
  issuerRecurrenceThreshold: number;
  /** RN-13: the causes each registered document type corresponds to. */
  documentTypeCauses: DocumentTypeCauses;
};

export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  issuerRecurrenceThreshold: 3,
  documentTypeCauses: DOCUMENT_TYPE_CAUSES,
};

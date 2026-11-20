import type { DocumentTypeCauses } from "./document-marks";
import { DOCUMENT_TYPE_CAUSES } from "./document-type-causes";

// Evaluation parameters (RN-13, RN-14, RNF-14). The recurrence threshold and the
// type-to-cause map are inputs of the evaluation, never read inside an
// evaluator. RNF-14 is NOT met: both values are code constants until roadmap
// row 8 replaces this source (the map is the part of RNF-14 this change covers).

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

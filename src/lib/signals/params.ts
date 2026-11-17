// Evaluation parameters (RN-14, RNF-14). The recurrence threshold is an input of
// the evaluation, never read inside an evaluator. RNF-14 is NOT met: the value
// is a code constant until roadmap row 8 replaces this source.

export type SignalParams = {
  /** Requests of one student, period and issuer at which RN-14 is present. */
  issuerRecurrenceThreshold: number;
};

export const DEFAULT_SIGNAL_PARAMS: SignalParams = {
  issuerRecurrenceThreshold: 3,
};

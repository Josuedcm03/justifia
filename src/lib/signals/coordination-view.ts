import type {
  SignalReport,
  SignalView,
  SignalViewResult,
} from "@/lib/signals/types";

// The coordination projection of a signals report (RF-05 a, RN-15, RN-26,
// RNF-01, RNF-02). The coordinator sees the outcome of each signal, the reason
// label of a signal that could not be evaluated and the suggested verdict; no
// extracted value, no date, no count, no document and never the number of
// another request. Every field is copied by name, so a field added to the
// report later stays out of this view until someone decides it may go in.

function projectResult(
  result: SignalReport["results"][number],
): SignalViewResult {
  // Exhaustive on purpose: a fifth outcome fails to compile here until someone
  // decides what the coordinator may see of it.
  switch (result.outcome) {
    case "present":
    case "absent":
      return { signal: result.signal, outcome: result.outcome };
    case "not_evaluable":
      return {
        signal: result.signal,
        outcome: result.outcome,
        reason: result.reason,
      };
    case "not_applicable":
      return { signal: result.signal, outcome: result.outcome };
  }
}

export function toCoordinationView(report: SignalReport): SignalView {
  return {
    verdict: report.verdict,
    results: report.results.map(projectResult),
    notEvaluable: report.notEvaluable.map(({ signal, reason }) => ({
      signal,
      reason,
    })),
  };
}

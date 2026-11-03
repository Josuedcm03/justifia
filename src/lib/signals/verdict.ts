import type { NotEvaluableEntry, SignalResult, Verdict } from "./types";

/**
 * The three-state suggestion (V1, RN-15): `review_carefully` when any signal is
 * present; `no_alerts` only when every signal is absent; `inconclusive`
 * otherwise, so a request whose extraction is still pending is never "no
 * alerts". The signals that could not be checked are listed apart, each with
 * its reason. It is a suggestion only: nothing reads it to decide anything.
 */
export function suggestVerdict(results: readonly SignalResult[]): {
  verdict: Verdict;
  notEvaluable: NotEvaluableEntry[];
} {
  const notEvaluable = results.flatMap((result) =>
    result.outcome === "not_evaluable"
      ? [{ signal: result.signal, reason: result.reason }]
      : [],
  );
  if (results.some((result) => result.outcome === "present")) {
    return { verdict: "review_carefully", notEvaluable };
  }
  const allAbsent =
    results.length > 0 &&
    results.every((result) => result.outcome === "absent");
  return { verdict: allAbsent ? "no_alerts" : "inconclusive", notEvaluable };
}

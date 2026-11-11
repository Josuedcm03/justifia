import type { NotEvaluableEntry, SignalResult, Verdict } from "./types";

/**
 * The three-state suggestion (V1, RN-15), over the applicable signals only
 * (`not_applicable` is ignored): `review_carefully` when any is present;
 * `no_alerts` only when at least one is applicable and every applicable one is
 * absent; `inconclusive` otherwise, so a request whose extraction is still
 * pending is never "no alerts". The signals that could not be checked are
 * listed apart, each with its reason; a not applicable signal is never listed. It is a suggestion only: nothing reads it to decide anything.
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
  const applicable = results.filter(
    (result) => result.outcome !== "not_applicable",
  );
  if (applicable.some((result) => result.outcome === "present")) {
    return { verdict: "review_carefully", notEvaluable };
  }
  const allAbsent =
    applicable.length > 0 &&
    applicable.every((result) => result.outcome === "absent");
  return { verdict: allAbsent ? "no_alerts" : "inconclusive", notEvaluable };
}

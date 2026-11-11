import { admitsRest } from "@/lib/intake/causes";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";

import { evaluateRecurrence } from "./issuer";
import type { SignalParams } from "./params";
import { evaluateRepeatedDocument } from "./repeated-document";
import { evaluateIncoherentDates, evaluateUncoveredDates } from "./rest-dates";
import { evaluateLatePresentation } from "./timing";
import type { SignalInput, SignalReport, SignalResult } from "./types";
import { suggestVerdict } from "./verdict";

/**
 * Evaluates the five signals (RN-09 and RN-10 only for a cause that admits
 * rest, otherwise `not_applicable`) over plain data (computed on every read, SNAP)
 * and builds the suggested verdict. Pure: the calendar and the parameters are
 * injected, and the report is never stored. Nothing outside the display reads
 * it (RN-15).
 */
export function evaluateSignals(
  input: SignalInput,
  params: SignalParams,
  calendar: NonWorkingDaysProvider,
): SignalReport {
  // RN-09 and RN-10 read a rest period, which only some causes can carry. The
  // cut comes first and never touches the extraction: the slots keep their
  // fixed place, so the screen can say why the two signals do not apply.
  const restSignals: SignalResult[] = admitsRest(input.causa)
    ? [
        evaluateIncoherentDates(input.documents),
        evaluateUncoveredDates(input.documents, {
          from: input.absenceFrom,
          to: input.absenceTo,
        }),
      ]
    : [
        { signal: "rn09", outcome: "not_applicable" },
        { signal: "rn10", outcome: "not_applicable" },
      ];
  const results: SignalResult[] = [
    evaluateLatePresentation(
      { absenceTo: input.absenceTo, presentedAt: input.presentedAt },
      calendar,
    ),
    ...restSignals,
    evaluateRecurrence(
      {
        solicitudId: input.solicitudId,
        documents: input.documents,
        periods: input.periods,
        history: input.issuerHistory,
      },
      params,
    ),
    evaluateRepeatedDocument(input.repeated),
  ];
  return { results, ...suggestVerdict(results) };
}

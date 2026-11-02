import type { NonWorkingDaysProvider } from "@/lib/intake/ports";

import { evaluateRecurrence } from "./issuer";
import type { SignalParams } from "./params";
import { evaluateRepeatedDocument } from "./repeated-document";
import { evaluateIncoherentDates, evaluateUncoveredDates } from "./rest-dates";
import { evaluateLatePresentation } from "./timing";
import type { SignalInput, SignalReport } from "./types";
import { suggestVerdict } from "./verdict";

/**
 * Evaluates the five signals over plain data (computed on every read, SNAP)
 * and builds the suggested verdict. Pure: the calendar and the parameters are
 * injected, and the report is never stored. Nothing outside the display reads
 * it (RN-15).
 */
export function evaluateSignals(
  input: SignalInput,
  params: SignalParams,
  calendar: NonWorkingDaysProvider,
): SignalReport {
  const results = [
    evaluateLatePresentation(
      { absenceTo: input.absenceTo, presentedAt: input.presentedAt },
      calendar,
    ),
    evaluateIncoherentDates(input.documents),
    evaluateUncoveredDates(input.documents, {
      from: input.absenceFrom,
      to: input.absenceTo,
    }),
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

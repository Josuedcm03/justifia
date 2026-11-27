import { addBusinessDays } from "@/lib/intake/business-days";
import { managuaToday } from "@/lib/intake/dates";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import type { TimingParams } from "@/lib/parameters/derive";

import type { SignalResult } from "./types";

/**
 * RN-07: the Managua date of the first presentation is after the deadline of
 * the absence end date, the N-th business day strictly after it, N being the
 * late-filing days parameter (`timing`, required: no default here). Same
 * calendar and day-counting function as the queue, but its own number: the
 * remission days of RN-08 never move this signal. The input has no
 * resubmission time, so a later resubmission can never move it. It needs no
 * extraction. Not evaluable when the calendar lacks the year of the end date
 * or of the deadline: the business-day count would be wrong.
 */
export function evaluateLatePresentation(
  input: { absenceTo: string; presentedAt: Date },
  calendar: NonWorkingDaysProvider,
  timing: TimingParams,
): SignalResult {
  const deadline = addBusinessDays(
    input.absenceTo,
    timing.lateFilingBusinessDays,
    calendar,
  );
  const covered = [input.absenceTo, deadline].every((iso) =>
    calendar.coversYear(Number(iso.slice(0, 4))),
  );
  if (!covered) {
    return {
      signal: "rn07",
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    };
  }

  const presented = managuaToday(input.presentedAt);
  return {
    signal: "rn07",
    outcome: presented > deadline ? "present" : "absent",
    evidence: { kind: "timing", presented, deadline },
  };
}

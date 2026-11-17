import { deadlineOf } from "@/lib/intake/business-days";
import { managuaToday } from "@/lib/intake/dates";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";

import type { SignalResult } from "./types";

/**
 * RN-07: the Managua date of the first presentation is after the RN-08
 * deadline of the absence end date. Same calendar and function as the queue.
 * The input has no resubmission time, so a later resubmission can never move
 * it. It needs no extraction. Not evaluable when the calendar lacks the year of
 * the end date or of the deadline: the business-day count would be wrong.
 */
export function evaluateLatePresentation(
  input: { absenceTo: string; presentedAt: Date },
  calendar: NonWorkingDaysProvider,
): SignalResult {
  const deadline = deadlineOf(input.absenceTo, calendar);
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

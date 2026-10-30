import { after } from "next/server";

import type { ExtractionQueue } from "../ports";
import { processRequestExtractions, type ExtractionDeps } from "../run";

// Post-commit hand-off of a request to extraction (DE-5): registers one
// `after()` callback that runs the request's documents once the response is
// sent. `after` runs even when the action ends in `redirect()` and within the
// route's `maxDuration` (N1, N2). Mirrors `scheduleDispatch` of the secretary
// actions: the submission is already committed, so neither a scheduling failure
// nor a failing run may reach the student; both are logged by error name only
// (RNF-04) and the daily sweep recovers the request.

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export function createAfterQueue(deps: ExtractionDeps): ExtractionQueue {
  return {
    enqueue(solicitudId, startedAt) {
      try {
        after(async () => {
          try {
            await processRequestExtractions(solicitudId, deps, { startedAt });
          } catch (error) {
            console.error("extraction_run_failed", {
              solicitudId,
              code: errorName(error),
            });
          }
        });
      } catch (error) {
        console.error("extraction_not_scheduled", {
          solicitudId,
          code: errorName(error),
        });
      }
    },
  };
}

import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";
import { env } from "@/env";
import {
  runIntakeSweep,
  type ExtractionSweepStep,
} from "@/lib/data/intake-sweep";
import { getIntakeDeps } from "@/lib/intake/deps";

// Daily cleanup of drafts, failed finalizations and orphan files (D8, D10),
// then the document-extraction backstop (DE-11). Only the platform scheduler
// may call it (shared credential check in `../scheduler-auth`). It writes no
// audit row (D14) and logs counts only.

// The whole run, cleanup and extraction, ends within this ceiling; the
// extraction deadline derives from it (DE-7, N2). Next reads segment config
// statically, so this must be a literal, not an import; `max-duration.test.ts`
// in the extraction slice pins it to EXTRACTION_MAX_DURATION_S.
export const maxDuration = 300;

// The extraction wiring is built, and its native libraries loaded, only when
// this step runs: a deployment where they cannot load then costs the extraction
// step (counted as a failure) and never the cleanup steps.
const extraction: ExtractionSweepStep = {
  async sweep(now, deadline) {
    const [{ getExtractionDeps }, { runExtractionSweep }] = await Promise.all([
      import("@/lib/extraction/deps"),
      import("@/lib/extraction/run"),
    ]);
    return runExtractionSweep(now, deadline, getExtractionDeps());
  },
};

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const counts = await runIntakeSweep(
      new Date(),
      getIntakeDeps().store,
      extraction,
    );
    console.info(JSON.stringify({ event: "intake.sweep", ...counts }));
    return Response.json(counts, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "sweep_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}

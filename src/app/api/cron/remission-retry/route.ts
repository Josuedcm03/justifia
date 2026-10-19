import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";
import { env } from "@/env";
import { selectRetryCandidates } from "@/lib/data/remision";
import { dispatchRemissions } from "@/lib/data/remission-dispatch";
import { getIntakeDeps } from "@/lib/intake/deps";

// Scheduled retry of the pending teacher remissions (teacher-remission, TR-12,
// RNF-07). Only the platform scheduler may call it (shared credential check in
// `../scheduler-auth`). One run dispatches a bounded batch of `pendiente` rows
// that are free, under the automatic-attempt cap, oldest first; `enviada` rows
// are never selected. The audit actor is the approving secretary, resolved by
// the dispatcher, never taken from the request. It responds and logs counts
// only.

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const ids = await selectRetryCandidates(new Date());
    const summary =
      ids.length === 0
        ? { sent: 0, failed: 0, blocked: 0, skipped: 0, lost: 0, errored: 0 }
        : await dispatchRemissions(
            ids,
            { trigger: "reintento_automatico" },
            getIntakeDeps(),
          );
    const counts = { selected: ids.length, ...summary };
    console.info(JSON.stringify({ event: "remission.retry", ...counts }));
    return Response.json(counts, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "retry_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}

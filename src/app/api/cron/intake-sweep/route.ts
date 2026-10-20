import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";
import { env } from "@/env";
import { runIntakeSweep } from "@/lib/data/intake-sweep";
import { getIntakeDeps } from "@/lib/intake/deps";

// Daily cleanup of drafts, failed finalizations and orphan files (D8, D10).
// Only the platform scheduler may call it (shared credential check in
// `../scheduler-auth`). It writes no audit row (D14) and logs counts only.

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const counts = await runIntakeSweep(new Date(), getIntakeDeps().store);
    console.info(JSON.stringify({ event: "intake.sweep", ...counts }));
    return Response.json(counts, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "sweep_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}

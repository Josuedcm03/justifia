import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";
import { env } from "@/env";
import { runRetention } from "@/lib/data/retention";
import { getIntakeDeps } from "@/lib/intake/deps";

// Daily data retention (RNF-04, RN-27): cancels the students whose last
// activity is more than five years old, one transaction each. Only the platform
// scheduler may call it (shared credential check in `../scheduler-auth`).
// `?dry=1` counts the due students and writes nothing (DR-9). Every cancelled
// student gets its own audit row in the data module; this route logs counts
// only and answers counts only.

// Up to 500 students a run, about 0.3 s each (D5). Next reads segment config
// statically, so this must be a literal, not an import.
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  // `new URL(request.url)`, not `nextUrl`: the access matrix passes a plain
  // `Request`.
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  try {
    const counts = await runRetention(new Date(), getIntakeDeps().store, {
      dryRun,
    });
    console.info(JSON.stringify({ event: "retention.run", ...counts }));
    return Response.json(counts, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "retention_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}

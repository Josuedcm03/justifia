import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";
import { env } from "@/env";
import { emptySummary, type DispatchSummary } from "@/lib/data/dispatch-batch";
import { selectEscalationRetryCandidates } from "@/lib/data/escalamiento";
import { dispatchEscalationNotices } from "@/lib/data/escalation-dispatch";
import { selectRetryCandidates } from "@/lib/data/remision";
import { dispatchRemissions } from "@/lib/data/remission-dispatch";
import { getEscalationDeps } from "@/lib/escalation/deps";
import { getIntakeDeps } from "@/lib/intake/deps";

// Scheduled retry of the two mail outboxes (teacher-remission, TR-12, RNF-07;
// escalation, ES-11). Only the platform scheduler may call it (shared
// credential check in `../scheduler-auth`). One run drains a bounded batch of
// `pendiente` teacher remissions and then a bounded batch of `pendiente`
// coordination notices: rows that are free, under the automatic-attempt cap,
// oldest first. `enviada` rows are never selected, and a `bloqueada` notice
// waits for a manual resend. Each outbox runs in its own try, so a failure in
// one never stops the other. The audit actor is the approving secretary of a
// remission and the escalating secretary of a notice, resolved by the
// dispatchers, never taken from the request. It responds and logs counts only;
// the remission counts stay at the top level and the notices add
// `escalamientos`.

type Counts = { selected: number } & DispatchSummary;

const AUTOMATIC_RETRY = { trigger: "reintento_automatico" } as const;

/** One outbox: the due ids, then their dispatch (dependencies built lazily). */
async function drain(
  select: (now: Date) => Promise<number[]>,
  dispatch: (ids: number[]) => Promise<DispatchSummary>,
): Promise<Counts> {
  const ids = await select(new Date());
  const summary = ids.length === 0 ? emptySummary() : await dispatch(ids);
  return { selected: ids.length, ...summary };
}

/** The counts, or null after logging the error name only. */
async function attempt(
  outbox: string,
  run: () => Promise<Counts>,
): Promise<Counts | null> {
  try {
    return await run();
  } catch (error) {
    console.error("remission_retry_failed", {
      outbox,
      code: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const remissions = await attempt("remisiones", () =>
    drain(selectRetryCandidates, (ids) =>
      dispatchRemissions(ids, AUTOMATIC_RETRY, getIntakeDeps()),
    ),
  );
  const notices = await attempt("escalamientos", () =>
    drain(selectEscalationRetryCandidates, (ids) =>
      dispatchEscalationNotices(ids, AUTOMATIC_RETRY, getEscalationDeps()),
    ),
  );
  if (!remissions || !notices) {
    return Response.json(
      { error: "retry_failed" },
      { status: 500, headers: NO_STORE },
    );
  }

  const counts = { ...remissions, escalamientos: notices };
  console.info(JSON.stringify({ event: "remission.retry", ...counts }));
  return Response.json(counts, { headers: NO_STORE });
}

"use server";

import { redirect } from "next/navigation";

import { afterResponse } from "@/app/(dashboard)/review/[id]/after-response";
import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { authorizeNoticeResend } from "@/lib/data/escalamiento";
import {
  dispatchEscalationNotice,
  dispatchEscalationNotices,
} from "@/lib/data/escalation-dispatch";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  escalateRequest,
  recordExcessReport,
} from "@/lib/data/solicitud-escalation";
import { getEscalationDeps } from "@/lib/escalation/deps";
import type {
  EscalationError,
  EscalationNoticeReason,
  EscalationNoticeState,
} from "@/lib/intake/escalation";

// The secretary's escalation and absence-report actions (RF-10, RF-15, RN-20,
// RNF-01, RNF-12). Each one re-checks the session, the role and the facultad
// scope itself, before it reads the payload: a page guard does not protect a
// Server Action. The actor is the session user and the scope comes from the
// database, never from the payload. The reason of an escalation is fixed by the
// data layer, so a client-sent reason is ignored; the note, the date and the
// teacher are validated there too, before any write. Success schedules the
// notice to coordination after the response (`after()`, only once the write has
// committed, so a mail outage can never undo it), then redirects (the queue for
// an escalation, the detail for a report) and never revalidates the page, so the
// audited detail read cannot run twice (SR-11); only refusals come back to the
// dialog. A secretary may resend a notice that is not `enviada`.

export type EscalationActionFailure =
  | { ok: false; reason: "not_found" | "conflict" | "unexpected" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] }
  | { ok: false; reason: "sin_coordinacion"; carreraNombre: string };

const QUEUE_PATH = "/review";
const NOT_FOUND = { ok: false, reason: "not_found" } as const;
const UNEXPECTED: EscalationActionFailure = {
  ok: false,
  reason: "unexpected",
};

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function payloadOf(input: unknown): Record<string, unknown> | null {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

/**
 * The session, role and scope checks both actions run first, then the payload
 * and its request id. `null` means the request is not found for this caller.
 */
async function authorize(input: unknown) {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") return null;
  const payload = payloadOf(input);
  if (!payload || !isId(payload.solicitudId)) return null;
  return { actorId, scope, payload, solicitudId: payload.solicitudId };
}

/**
 * Sends the new notice once the response has been sent. The write is already
 * committed: a failure here leaves the notice `pendiente` for the scheduled
 * retry and for the resend control.
 */
function scheduleNotice(escalamientoId: number, actorId: number) {
  afterResponse("escalation_notice_dispatch", () =>
    dispatchEscalationNotices(
      [escalamientoId],
      { trigger: "escalamiento", actorId },
      getEscalationDeps(),
    ),
  );
}

/** Logs the error name only: a data error message may hold personal data. */
function failed(event: string, error: unknown): EscalationActionFailure {
  console.error(event, {
    code: error instanceof Error ? error.name : "unknown",
  });
  return UNEXPECTED;
}

export async function escalateRequestAction(
  input: unknown,
): Promise<EscalationActionFailure> {
  const guard = await authorize(input);
  if (!guard) return NOT_FOUND;
  const { actorId, scope, payload, solicitudId } = guard;

  let outcome;
  try {
    outcome = await escalateRequest({
      actorId,
      scope,
      solicitudId,
      nota: payload.nota as string,
      now: new Date(),
    });
  } catch (error) {
    return failed("request_escalation_failed", error);
  }
  if (!outcome.ok) return outcome;
  scheduleNotice(outcome.escalamientoId, actorId);
  redirect(`${QUEUE_PATH}?resultado=escalada`);
}

export async function recordExcessReportAction(
  input: unknown,
): Promise<EscalationActionFailure> {
  const guard = await authorize(input);
  if (!guard) return NOT_FOUND;
  const { actorId, scope, payload, solicitudId } = guard;
  if (!isId(payload.remisionId)) {
    return {
      ok: false,
      reason: "invalid",
      errors: [{ field: "docente", code: "docente_invalid" }],
    };
  }

  let outcome;
  try {
    outcome = await recordExcessReport({
      actorId,
      scope,
      solicitudId,
      remisionId: payload.remisionId,
      comunicadoEl: payload.comunicadoEl,
      nota: payload.nota,
      now: new Date(),
    });
  } catch (error) {
    return failed("absence_report_failed", error);
  }
  if (!outcome.ok) return outcome;
  scheduleNotice(outcome.escalamientoId, actorId);
  redirect(`${QUEUE_PATH}/${solicitudId}`);
}

export type ResendNoticeResult =
  | {
      ok: true;
      estado: EscalationNoticeState;
      motivo: EscalationNoticeReason | null;
    }
  | { ok: false; reason: "not_found" | "unexpected" };

/**
 * Resend of a notice that is not `enviada` (RF-10 b). An unknown id and an
 * out-of-scope id get the same answer; a sent notice sends nothing and writes
 * no audit row. The outcome is returned as text for the control: the page is
 * not revalidated (SR-11).
 */
export async function resendEscalationNoticeAction(
  escalamientoId: unknown,
): Promise<ResendNoticeResult> {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none" || !isId(escalamientoId)) return NOT_FOUND;

  const target = await authorizeNoticeResend(scope, escalamientoId, actorId);
  if (!target) return NOT_FOUND;
  // A sent notice is never sent twice: report it as it is.
  if (target.estado === "enviada") {
    return { ok: true, estado: "enviada", motivo: null };
  }

  try {
    const result = await dispatchEscalationNotice(
      escalamientoId,
      { trigger: "reenvio_manual", actorId },
      getEscalationDeps(),
    );
    switch (result.outcome) {
      case "sent":
        return { ok: true, estado: "enviada", motivo: null };
      case "failed":
        return { ok: true, estado: "pendiente", motivo: "error_envio" };
      case "blocked":
        return { ok: true, estado: "bloqueada", motivo: result.motivo };
      default:
        // Another attempt holds it, or the lease was taken over: still pending.
        return { ok: true, estado: "pendiente", motivo: null };
    }
  } catch (error) {
    console.error("escalation_notice_resend_failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "unexpected" };
  }
}

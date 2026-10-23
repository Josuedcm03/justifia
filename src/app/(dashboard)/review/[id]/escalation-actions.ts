"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  escalateRequest,
  recordExcessReport,
} from "@/lib/data/solicitud-escalation";
import type { EscalationError } from "@/lib/intake/escalation";

// The secretary's escalation and absence-report actions (RF-10, RF-15, RN-20,
// RNF-01, RNF-12). Each one re-checks the session, the role and the facultad
// scope itself, before it reads the payload: a page guard does not protect a
// Server Action. The actor is the session user and the scope comes from the
// database, never from the payload. The reason of an escalation is fixed by the
// data layer, so a client-sent reason is ignored; the note, the date and the
// teacher are validated there too, before any write. Success redirects (the
// queue for an escalation, the detail for a report) and never revalidates the
// page, so the audited detail read cannot run twice (SR-11); only refusals
// come back to the dialog.

export type EscalationActionFailure =
  | { ok: false; reason: "not_found" | "conflict" | "unexpected" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] }
  | { ok: false; reason: "sin_coordinacion"; carreraNombre: string };

const QUEUE_PATH = "/review";
const NOT_FOUND: EscalationActionFailure = { ok: false, reason: "not_found" };
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
  redirect(`${QUEUE_PATH}/${solicitudId}`);
}

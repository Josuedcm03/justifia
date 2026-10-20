"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { dispatchRemissions } from "@/lib/data/remission-dispatch";
import { decideRequest } from "@/lib/data/solicitud-decision";
import { getIntakeDeps } from "@/lib/intake/deps";
import {
  validateDecision,
  type DecisionError,
} from "@/lib/intake/decision-validation";

// The secretary's decision (RF-07, RN-15, RNF-01, RNF-12). The action re-checks
// the session, the role and the facultad scope itself: a page guard does not
// protect a Server Action, and the client is never trusted (a direct call with
// empty reject text is refused here, whatever the dialog allowed). The actor is
// the session user and the scope comes from the database, never from the
// payload. Success redirects to the queue with a status and never revalidates
// the detail, so the audited detail read cannot run twice (SR-11).

export type DecideFailure =
  | { ok: false; reason: "invalid"; errors: DecisionError[] }
  | { ok: false; reason: "conflict" | "not_found" };

const QUEUE_PATH = "/review";

/**
 * Sends the remissions of an approval after the response (TR-8). The mail
 * never decides the outcome: the approval is already committed, so any
 * failure here is logged by code only and left to the retry job and the
 * manual resend. The dependencies are built inside the callback because a
 * missing store configuration must not surface to the secretary.
 */
async function dispatchApproved(remisionIds: number[], actorId: number) {
  try {
    await dispatchRemissions(
      remisionIds,
      { trigger: "aprobacion", actorId },
      getIntakeDeps(),
    );
  } catch (error) {
    console.error("remission_dispatch_failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

function scheduleDispatch(remisionIds: number[], actorId: number) {
  try {
    after(() => dispatchApproved(remisionIds, actorId));
  } catch (error) {
    console.error("remission_dispatch_not_scheduled", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

const payloadSchema = z.object({
  solicitudId: z.unknown(),
  tipo: z.string(),
  plantilla: z.string(),
  motivo: z.string().nullish(),
  texto: z.string().nullable(),
});

const MALFORMED: DecideFailure = {
  ok: false,
  reason: "invalid",
  errors: [{ field: "tipo", code: "tipo_invalid" }],
};

const NOT_FOUND: DecideFailure = { ok: false, reason: "not_found" };

export async function decideAction(input: unknown): Promise<DecideFailure> {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return MALFORMED;
  const { solicitudId, tipo, plantilla, motivo, texto } = parsed.data;
  if (
    typeof solicitudId !== "number" ||
    !Number.isSafeInteger(solicitudId) ||
    solicitudId <= 0
  ) {
    return NOT_FOUND;
  }

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") return NOT_FOUND;

  const checked = validateDecision({ tipo, plantilla, motivo, texto });
  if (!checked.ok) {
    return { ok: false, reason: "invalid", errors: checked.errors };
  }

  const outcome = await decideRequest({
    actorId,
    scope,
    solicitudId,
    decision: checked.decision,
    now: new Date(),
  });
  if (!outcome.ok) {
    return outcome.reason === "invalid"
      ? { ok: false, reason: "invalid", errors: [] }
      : { ok: false, reason: outcome.reason };
  }

  // A marked approval (RN-19) creates every remission blocked until the
  // signed format is uploaded, so there is nothing to send yet; its upload
  // dispatches them. The secretary lands on the detail, where the upload is.
  if (outcome.formatoEspecial) redirect(`${QUEUE_PATH}/${solicitudId}`);

  if (outcome.remisionIds.length > 0) {
    scheduleDispatch(outcome.remisionIds, actorId);
  }
  redirect(`${QUEUE_PATH}?resultado=${checked.decision.tipo}`);
}

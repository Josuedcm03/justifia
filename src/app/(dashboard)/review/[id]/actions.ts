"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { decideRequest } from "@/lib/data/solicitud-decision";
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
  redirect(`${QUEUE_PATH}?resultado=${checked.decision.tipo}`);
}

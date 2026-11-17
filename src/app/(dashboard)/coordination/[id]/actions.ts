"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { rolesCoordinadores } from "@/lib/auth/permissions";
import { resolveCoordinationScope } from "@/lib/data/coordination-scope";
import { answerEscalation } from "@/lib/data/escalation-answer";
import { calendar } from "@/lib/intake/calendar";
import type { EscalationError } from "@/lib/intake/escalation";

// The coordinator's answer to an open escalation (RF-10, E1, E3, RNF-01,
// RNF-12). The action re-checks the session, the role and the career scope
// itself, before it reads the payload: a page guard does not protect a Server
// Action. The actor is the session user and the scope comes from the database,
// never from the payload; a client-sent actor, scope or request id is ignored.
// The text is validated by the data layer before any write. Success redirects
// to the list with a status and never revalidates, so the audited list read
// cannot run twice (SR-11); only refusals come back to the form.

export type AnswerActionFailure =
  | { ok: false; reason: "not_found" | "conflict" | "unexpected" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] };

const LIST_PATH = "/coordination";
const NOT_FOUND = { ok: false, reason: "not_found" } as const;

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function answerEscalationAction(
  input: unknown,
): Promise<AnswerActionFailure> {
  const user = await requireRole(...rolesCoordinadores);
  const actorId = Number(user.sub);

  const scope = await resolveCoordinationScope(actorId, user.rol);
  if (scope.kind === "none") return NOT_FOUND;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return NOT_FOUND;
  }
  const payload = input as Record<string, unknown>;
  if (!isId(payload.escalamientoId)) return NOT_FOUND;

  let outcome;
  try {
    outcome = await answerEscalation({
      actorId,
      scope,
      escalamientoId: payload.escalamientoId,
      respuesta: payload.texto,
      now: new Date(),
      calendar,
    });
  } catch (error) {
    // The error name only: a data error message may hold personal data.
    console.error("escalation_answer_failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "unexpected" };
  }
  if (!outcome.ok) return outcome;
  redirect(`${LIST_PATH}?resultado=respondida`);
}

import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { escalamiento, solicitud } from "@/db/schema";
import { solicitudEscalamientoResueltoEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import { escalationInScope } from "@/lib/data/coordination-scope-sql";
import type { CoordinationScope } from "@/lib/intake/coordination-scope";
import { clockStartOf, pausedStartOnAnswer } from "@/lib/intake/deadline-clock";
import {
  ESCALATION_REASON,
  validateAnswerText,
  type EscalationError,
} from "@/lib/intake/escalation";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import { sourceOf } from "@/lib/intake/transitions";

// The coordinator's answer to an open escalation (RF-10, E1, E3; ES-8). One
// transaction, like `decideRequest`: a guarded UPDATE closes the escalation only
// while it is open, a suspicion and in the caller's career; a second guarded
// UPDATE returns the request to `pendiente` and, when business days were spent
// in coordination, stores the shifted RN-08 clock start; one audit row. The
// answer never approves, rejects or returns anything and writes no
// `SolicitudDecision`. Two concurrent answers serialise on the escalation row:
// the loser matches nothing and reports `conflict`. The caller (a Server
// Action) authorises the role and resolves the scope; the actor is the session
// user, never request input.

/** The state a suspicion holds the request in, and the one it returns to. */
const COORDINATION_STATE = sourceOf("pendiente", "coordinacion");
const RETURN_STATE = "pendiente";

export type AnswerOutcome =
  | { ok: true; solicitudId: number }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] };

export type AnswerInput = {
  actorId: number;
  scope: CoordinationScope;
  escalamientoId: number;
  respuesta: unknown;
  now: Date;
  calendar: NonWorkingDaysProvider;
};

export async function answerEscalation(
  input: AnswerInput,
): Promise<AnswerOutcome> {
  const { actorId, scope, escalamientoId, now, calendar } = input;
  const checked = validateAnswerText(input.respuesta);
  if (!checked.ok) {
    return { ok: false, reason: "invalid", errors: checked.errors };
  }
  if (scope.kind === "none") return { ok: false, reason: "not_found" };

  return db.transaction(async (tx): Promise<AnswerOutcome> => {
    const [closed] = await tx
      .update(escalamiento)
      .set({
        respuesta: checked.texto,
        respondidaPorId: actorId,
        respondidaEn: now,
      })
      .where(
        and(
          eq(escalamiento.id, escalamientoId),
          eq(escalamiento.tipo, ESCALATION_REASON),
          isNull(escalamiento.respondidaEn),
          escalationInScope(scope),
        ),
      )
      .returning({
        solicitudId: escalamiento.solicitudId,
        creadoEn: escalamiento.creadoEn,
      });
    if (!closed) {
      // Already answered by someone else, or not ours to see: the first is the
      // concurrent loser, the second (another career, a notice, an unknown id)
      // is indistinguishable from a missing record.
      const [seen] = await tx
        .select({ id: escalamiento.id })
        .from(escalamiento)
        .where(
          and(
            eq(escalamiento.id, escalamientoId),
            eq(escalamiento.tipo, ESCALATION_REASON),
            escalationInScope(scope),
          ),
        );
      return { ok: false, reason: seen ? "conflict" : "not_found" };
    }

    // Nothing else writes the clock columns while the request is in
    // coordination, so this read is stable within the transaction.
    const [clock] = await tx
      .select({
        presentadaEn: solicitud.presentadaEn,
        reenviadaEn: solicitud.reenviadaEn,
        plazoInicioEn: solicitud.plazoInicioEn,
      })
      .from(solicitud)
      .where(eq(solicitud.id, closed.solicitudId));
    if (!clock) throw new Error(`Request ${closed.solicitudId} vanished`);
    const pausedStart = pausedStartOnAnswer(
      {
        clockStart: clockStartOf(clock),
        escalatedAt: closed.creadoEn,
        answeredAt: now,
      },
      calendar,
    );

    const [returned] = await tx
      .update(solicitud)
      .set({
        estado: RETURN_STATE,
        ...(pausedStart ? { plazoInicioEn: pausedStart } : {}),
        actualizadoEn: now,
      })
      .where(
        and(
          eq(solicitud.id, closed.solicitudId),
          eq(solicitud.estado, COORDINATION_STATE),
        ),
      )
      .returning({ id: solicitud.id });
    // An open suspicion implies the request is in coordination; if not, the
    // data is inconsistent: throw so the answer is undone, never half applied.
    if (!returned) {
      throw new Error(
        `Request ${closed.solicitudId} with an open escalation is not in ${COORDINATION_STATE}`,
      );
    }

    await insertAuditEvents(tx, actorId, [
      solicitudEscalamientoResueltoEvent({
        solicitudId: closed.solicitudId,
        escalamientoId,
        estadoPrevio: COORDINATION_STATE,
        estadoNuevo: RETURN_STATE,
      }),
    ]);
    return { ok: true, solicitudId: closed.solicitudId };
  });
}

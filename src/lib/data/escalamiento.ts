import "server-only";

import { and, asc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  carrera,
  escalamiento,
  reporteInasistencia,
  rol,
  solicitud,
  usuario,
} from "@/db/schema";
import {
  escalamientoNotificacionBloqueadaEvent,
  escalamientoNotificacionEnviadaEvent,
  escalamientoNotificacionFallidaEvent,
  escalamientoNotificacionReenviadaEvent,
} from "@/lib/audit/events";
import type { MailFailureCode } from "@/lib/audit/types";
import { insertAuditEvents } from "@/lib/data/audit";
import {
  attemptGivenBack,
  claimRelease,
  claimStamp,
  completeHeld,
  leaseFree,
  sentStamp,
} from "@/lib/data/outbox";
import { requestInScope } from "@/lib/data/request-scope-sql";
import type {
  EscalationKind,
  EscalationNoticeReason,
  EscalationNoticeState,
  EscalationNoticeTrigger,
} from "@/lib/intake/escalation";
import type { RequestScope } from "@/lib/intake/request-scope";
import { MAX_AUTO_ATTEMPTS, RETRY_BATCH_SIZE } from "@/lib/remission/limits";

// The ONLY module that updates the notification columns of `Escalamiento` after
// creation (escalation, ES-1, ES-11): the claim, the guarded completions, the
// reads of the outbox and the recipients. The row is created by
// `solicitud-escalation.ts` inside the write transaction and its answer columns
// belong to the coordinator's answer module; a structural test pins the split.
// The claim and lease mechanics are shared with `remision.ts` (`outbox.ts`).

/** A notice as the dispatcher sees it right after winning the claim. */
export type EscalationNoticeClaim = {
  id: number;
  solicitudId: number;
  tipo: EscalationKind;
  /** The secretary who escalated: the audit actor of the scheduled retry. */
  secretariaId: number;
  /** State when claimed, i.e. before this attempt changes anything. */
  estado: EscalationNoticeState;
  motivo: EscalationNoticeReason | null;
  /** Attempts including this one. */
  intentos: number;
  reclamoId: string;
};

/**
 * Source states a trigger may claim. `enviada` is terminal and is in none of
 * them. Only a secretary's resend may pick up a `bloqueada` notice: a
 * coordinator account may exist by then; the scheduled job never retries it.
 */
function claimableStates(
  trigger: EscalationNoticeTrigger,
): readonly EscalationNoticeState[] {
  return trigger === "reenvio_manual"
    ? ["pendiente", "bloqueada"]
    : ["pendiente"];
}

/**
 * Guarded claim of one notice: `UPDATE ... WHERE ... RETURNING`. Null means
 * another attempt holds it or it is already sent: skip silently.
 */
export async function claimEscalationNotice(
  id: number,
  trigger: EscalationNoticeTrigger,
  now: Date = new Date(),
): Promise<EscalationNoticeClaim | null> {
  const [claimed] = await db
    .update(escalamiento)
    .set(claimStamp(escalamiento, now))
    .where(
      and(
        eq(escalamiento.id, id),
        inArray(escalamiento.notificacionEstado, [...claimableStates(trigger)]),
        leaseFree(escalamiento.reclamadaEn, now),
      ),
    )
    .returning({
      id: escalamiento.id,
      solicitudId: escalamiento.solicitudId,
      tipo: escalamiento.tipo,
      secretariaId: escalamiento.secretariaId,
      estado: escalamiento.notificacionEstado,
      motivo: escalamiento.notificacionMotivo,
      intentos: escalamiento.intentos,
      reclamoId: escalamiento.reclamoId,
    });
  return (claimed as EscalationNoticeClaim | undefined) ?? null;
}

type Completion = {
  now: Date;
  /** Session user, or the escalating secretary for the scheduled retry. */
  actorId: number;
  origen: EscalationNoticeTrigger;
};

/** The provider accepted the message. */
export function completeNoticeSent(
  claim: EscalationNoticeClaim,
  args: Completion & { providerId: string; destinatarios: number },
): Promise<boolean> {
  return completeHeld(
    escalamiento,
    claim,
    args.actorId,
    {
      notificacionEstado: "enviada",
      notificacionMotivo: null,
      ...sentStamp(args.providerId, args.now),
      ...claimRelease(args.now),
    },
    escalamientoNotificacionEnviadaEvent({
      escalamientoId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      intentos: claim.intentos,
      destinatarios: args.destinatarios,
    }),
  );
}

/** A failed attempt stays `pendiente` with `error_envio` (RNF-07 b). */
export function completeNoticeFailed(
  claim: EscalationNoticeClaim,
  args: Completion & { codigo: MailFailureCode },
): Promise<boolean> {
  return completeHeld(
    escalamiento,
    claim,
    args.actorId,
    {
      notificacionEstado: "pendiente",
      notificacionMotivo: "error_envio",
      ...attemptGivenBack(escalamiento, args.codigo),
      ...claimRelease(args.now),
    },
    escalamientoNotificacionFallidaEvent({
      escalamientoId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      intentos: claim.intentos,
      codigo: args.codigo,
    }),
  );
}

/** No recipient was found: nothing is sent, the reason is shown. */
export function completeNoticeBlocked(
  claim: EscalationNoticeClaim,
  args: Completion,
): Promise<boolean> {
  return completeHeld(
    escalamiento,
    claim,
    args.actorId,
    {
      notificacionEstado: "bloqueada",
      notificacionMotivo: "sin_destinatarios",
      ...claimRelease(args.now),
    },
    escalamientoNotificacionBloqueadaEvent({
      escalamientoId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      motivo: "sin_destinatarios",
    }),
  );
}

/**
 * The notices the scheduled job may dispatch: pending, free or expired claim,
 * under the automatic-attempt cap, oldest first, one bounded batch. A
 * `bloqueada` or `enviada` notice is never selected.
 */
export async function selectEscalationRetryCandidates(
  now: Date = new Date(),
): Promise<number[]> {
  const rows = await db
    .select({ id: escalamiento.id })
    .from(escalamiento)
    .where(
      and(
        eq(escalamiento.notificacionEstado, "pendiente"),
        leaseFree(escalamiento.reclamadaEn, now),
        lt(escalamiento.intentos, MAX_AUTO_ATTEMPTS),
      ),
    )
    .orderBy(asc(escalamiento.creadoEn), asc(escalamiento.id))
    .limit(RETRY_BATCH_SIZE);
  return rows.map((r) => r.id);
}

/**
 * A secretary's resend of a notice (RF-10 b, RNF-01): proves the notice's
 * request is in her scope (an unknown and an out-of-scope id are the same
 * `null`) and, when the notice is not `enviada`, writes the
 * `notificacion_reenviada` audit row with the state it started from. A sent
 * notice sends nothing and writes nothing.
 */
export async function authorizeNoticeResend(
  scope: RequestScope,
  escalamientoId: number,
  actorId: number,
): Promise<{
  id: number;
  solicitudId: number;
  estado: EscalationNoticeState;
} | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: escalamiento.id,
        solicitudId: escalamiento.solicitudId,
        estado: escalamiento.notificacionEstado,
      })
      .from(escalamiento)
      .innerJoin(solicitud, eq(solicitud.id, escalamiento.solicitudId))
      .where(and(eq(escalamiento.id, escalamientoId), requestInScope(scope)))
      .limit(1);
    if (!target) return null;
    if (target.estado !== "enviada") {
      await insertAuditEvents(tx, actorId, [
        escalamientoNotificacionReenviadaEvent({
          escalamientoId: target.id,
          solicitudId: target.solicitudId,
          estadoPrevio: target.estado,
        }),
      ]);
    }
    return target;
  });
}

/**
 * The emails of the active `coordinacion` accounts of the student's CURRENT
 * career, by id (ES-3, ES-10). One statement resolves them at every attempt, so
 * an account created or deactivated since the escalation is honoured; nothing
 * is frozen on the row.
 */
export async function listCoordinationRecipients(
  solicitudId: number,
): Promise<string[]> {
  const student = alias(usuario, "estudiante");
  const rows = await db
    .select({ correo: usuario.correo })
    .from(solicitud)
    .innerJoin(student, eq(student.id, solicitud.estudianteId))
    .innerJoin(usuario, eq(usuario.carreraId, student.carreraId))
    .innerJoin(rol, eq(rol.id, usuario.rolId))
    .where(
      and(
        eq(solicitud.id, solicitudId),
        eq(rol.codigo, "coordinacion"),
        eq(usuario.activo, true),
        isNotNull(usuario.correo),
      ),
    )
    .orderBy(asc(usuario.id));
  return rows.flatMap((r) => (r.correo?.trim() ? [r.correo] : []));
}

/** What the message needs about the notice, at the time of the send. */
export type NoticeContext = {
  escalamientoId: number;
  solicitudId: number;
  tipo: EscalationKind;
  /** The escalation note (suspicion) or the report note (excess), when any. */
  nota: string | null;
  estudianteNombre: string;
  estudianteCif: string;
  /** The student's current career. */
  carreraNombre: string;
};

/**
 * Null when the notice is gone or lacks a field the message needs. The student
 * name and CIF are the ones recorded at submission, like the remission.
 */
export async function loadNoticeContext(
  escalamientoId: number,
): Promise<NoticeContext | null> {
  const [row] = await db
    .select({
      escalamientoId: escalamiento.id,
      solicitudId: escalamiento.solicitudId,
      tipo: escalamiento.tipo,
      nota: escalamiento.nota,
      reporteNota: reporteInasistencia.nota,
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      carreraNombre: carrera.nombre,
    })
    .from(escalamiento)
    .innerJoin(solicitud, eq(solicitud.id, escalamiento.solicitudId))
    .innerJoin(usuario, eq(usuario.id, solicitud.estudianteId))
    .innerJoin(carrera, eq(carrera.id, usuario.carreraId))
    .leftJoin(
      reporteInasistencia,
      eq(reporteInasistencia.id, escalamiento.reporteId),
    )
    .where(eq(escalamiento.id, escalamientoId))
    .limit(1);
  if (!row || !row.estudianteNombre || !row.estudianteCif) return null;

  return {
    escalamientoId: row.escalamientoId,
    solicitudId: row.solicitudId,
    tipo: row.tipo as EscalationKind,
    nota: row.nota ?? row.reporteNota,
    estudianteNombre: row.estudianteNombre,
    estudianteCif: row.estudianteCif,
    carreraNombre: row.carreraNombre,
  };
}

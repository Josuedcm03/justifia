import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { effectiveClockStart } from "@/db/clock-start";
import {
  escalamiento,
  reporteInasistencia,
  solicitud,
  solicitudDecision,
} from "@/db/schema";
import { requestInScope } from "@/lib/data/request-scope-sql";
import { listRequestClasses } from "@/lib/data/solicitud-clases";
import {
  deadlineStatus,
  type DeadlineStatus,
} from "@/lib/intake/business-days";
import { managuaToday } from "@/lib/intake/dates";
import { clockStartOf } from "@/lib/intake/deadline-clock";
import {
  ESCALATION_REASON,
  type EscalationKind,
  type EscalationNoticeReason,
  type EscalationNoticeState,
} from "@/lib/intake/escalation";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import type { RequestScope } from "@/lib/intake/request-scope";

// The three review tabs (RF-06, RF-10, RF-15, E14). Each one lists the in-scope
// requests of one state and nothing else, so `rechazada`, `devuelta` and
// `borrador` appear in none. Pendientes is oldest effective start first: the
// order equals the deadline order because adding business days is monotone, so
// SQL needs no calendar, and the stored start (ES-5) moves a request that spent
// time in coordination later than one that did not.

/** The student snapshot every tab lists, in the order the selects name it. */
const STUDENT = {
  estudianteNombre: solicitud.estudianteNombre,
  estudianteCif: solicitud.estudianteCif,
  estudianteCarrera: solicitud.estudianteCarrera,
};

export type QueueRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  estudianteCarrera: string | null;
  /** Number of classes of the request (the cause is never listed here). */
  asignaturas: number;
  /** `ReenviadaEn` when resubmitted, else `PresentadaEn`: the receipt date. */
  clockStart: Date;
  reenviada: boolean;
  /** Managua `YYYY-MM-DD` of the remission deadline (RN-08), pause included. */
  deadline: string;
  status: DeadlineStatus;
};

export type ReviewQueue = {
  rows: QueueRow[];
  /** False when the calendar has no entries for the current year (muted note). */
  calendarLoaded: boolean;
};

export async function listReviewQueue(
  scope: RequestScope,
  now: Date,
  calendar: NonWorkingDaysProvider,
): Promise<ReviewQueue> {
  const today = managuaToday(now);
  const calendarLoaded = calendar.coversYear(Number(today.slice(0, 4)));

  const rows = await db
    .select({
      id: solicitud.id,
      presentadaEn: solicitud.presentadaEn,
      reenviadaEn: solicitud.reenviadaEn,
      plazoInicioEn: solicitud.plazoInicioEn,
      ...STUDENT,
    })
    .from(solicitud)
    .where(and(eq(solicitud.estado, "pendiente"), requestInScope(scope)))
    .orderBy(asc(effectiveClockStart(solicitud)), asc(solicitud.id));

  const classes = await listRequestClasses(
    db,
    rows.map((r) => r.id),
  );

  return {
    calendarLoaded,
    rows: rows.map((r) => {
      const clockStart = r.reenviadaEn ?? r.presentadaEn;
      if (clockStart === null) {
        throw new Error(`Pending request ${r.id} has no presentation date`);
      }
      const { status, deadline } = deadlineStatus(
        managuaToday(clockStartOf(r)),
        today,
        calendar,
      );
      return {
        id: r.id,
        estudianteNombre: r.estudianteNombre,
        estudianteCif: r.estudianteCif,
        estudianteCarrera: r.estudianteCarrera,
        asignaturas: classes.get(r.id)?.length ?? 0,
        clockStart,
        reenviada: r.reenviadaEn !== null,
        deadline,
        status,
      };
    }),
  };
}

export type CoordinationQueueRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  estudianteCarrera: string | null;
  asignaturas: number;
  /** The reason label code of the open escalation. */
  motivo: EscalationKind;
  /** When the secretary escalated it (oldest first). */
  escaladaEn: Date;
  notificacionEstado: EscalationNoticeState;
  notificacionMotivo: EscalationNoticeReason | null;
  /** When the notice was sent; set only for an `enviada` notification. */
  enviadaEn: Date | null;
};

/**
 * Requests in `en_revision_coordinacion` with their open suspicion, oldest
 * escalation first. The deadline is paused here, so the row carries no deadline;
 * the page shows the `en_pausa` display status.
 */
export async function listCoordinationQueue(
  scope: RequestScope,
): Promise<{ rows: CoordinationQueueRow[] }> {
  const rows = await db
    .select({
      id: solicitud.id,
      ...STUDENT,
      motivo: escalamiento.tipo,
      escaladaEn: escalamiento.creadoEn,
      notificacionEstado: escalamiento.notificacionEstado,
      notificacionMotivo: escalamiento.notificacionMotivo,
      enviadaEn: escalamiento.enviadaEn,
    })
    .from(solicitud)
    .innerJoin(escalamiento, eq(escalamiento.solicitudId, solicitud.id))
    .where(
      and(
        eq(solicitud.estado, "en_revision_coordinacion"),
        eq(escalamiento.tipo, ESCALATION_REASON),
        isNull(escalamiento.respondidaEn),
        requestInScope(scope),
      ),
    )
    .orderBy(asc(escalamiento.creadoEn), asc(solicitud.id));

  const classes = await listRequestClasses(
    db,
    rows.map((r) => r.id),
  );

  return {
    rows: rows.map((r) => ({
      id: r.id,
      estudianteNombre: r.estudianteNombre,
      estudianteCif: r.estudianteCif,
      estudianteCarrera: r.estudianteCarrera,
      asignaturas: classes.get(r.id)?.length ?? 0,
      motivo: r.motivo as EscalationKind,
      escaladaEn: r.escaladaEn,
      notificacionEstado: r.notificacionEstado,
      notificacionMotivo: r.notificacionMotivo,
      enviadaEn: r.enviadaEn,
    })),
  };
}

/** The Aprobadas tab lists at most this many, newest approval first (E14). */
export const APPROVED_TAB_LIMIT = 50;

export type ApprovedRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  estudianteCarrera: string | null;
  aprobadaEn: Date;
  /** RF-15 reports recorded on the request. */
  reportes: number;
};

/** Approved requests by approval time, newest first, with the report count. */
export async function listApprovedRequests(
  scope: RequestScope,
): Promise<{ rows: ApprovedRow[] }> {
  const rows = await db
    .select({
      id: solicitud.id,
      ...STUDENT,
      aprobadaEn: solicitudDecision.decididaEn,
      reportes:
        sql<number>`(select count(*) from ${reporteInasistencia} where ${reporteInasistencia.solicitudId} = ${solicitud.id})`.mapWith(
          Number,
        ),
    })
    .from(solicitud)
    .innerJoin(
      solicitudDecision,
      eq(solicitudDecision.solicitudId, solicitud.id),
    )
    .where(
      and(
        eq(solicitud.estado, "aprobada"),
        eq(solicitudDecision.tipo, "aprobada"),
        requestInScope(scope),
      ),
    )
    .orderBy(desc(solicitudDecision.decididaEn), desc(solicitud.id))
    .limit(APPROVED_TAB_LIMIT);

  return { rows };
}

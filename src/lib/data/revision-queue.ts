import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { solicitud } from "@/db/schema";
import { requestInScope } from "@/lib/data/request-scope-sql";
import { listRequestClasses } from "@/lib/data/solicitud-clases";
import {
  deadlineStatus,
  type DeadlineStatus,
} from "@/lib/intake/business-days";
import { managuaToday } from "@/lib/intake/dates";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import type { RequestScope } from "@/lib/intake/request-scope";

// The review queue (RF-06, SR-5, SR-6): pendiente requests of the caller's
// facultad, oldest clock start first. The order equals the deadline order
// because adding business days is monotone, so SQL needs no calendar.

export type QueueRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  estudianteCarrera: string | null;
  /** Number of classes of the request (the cause is never listed here). */
  asignaturas: number;
  /** `ReenviadaEn` when resubmitted, else `PresentadaEn`. */
  clockStart: Date;
  reenviada: boolean;
  /** Managua `YYYY-MM-DD` of the remission deadline (RN-08). */
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
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      estudianteCarrera: solicitud.estudianteCarrera,
    })
    .from(solicitud)
    .where(and(eq(solicitud.estado, "pendiente"), requestInScope(scope)))
    .orderBy(
      asc(sql`coalesce(${solicitud.reenviadaEn}, ${solicitud.presentadaEn})`),
      asc(solicitud.id),
    );

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
        managuaToday(clockStart),
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

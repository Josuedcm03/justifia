import "server-only";

import { cache } from "react";

import { db } from "@/db";
import {
  solicitudRankingConsultadoEvent,
  solicitudReporteConsultadoEvent,
} from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import type { Causa } from "@/lib/intake/causes";

// Audited coordination report reads (RF-17 e, RNF-06, CR-7). The caller is the
// report `page.tsx` files only, after authorisation and after the data loaded, so
// no data is shown without its audit row: a failed insert throws to the error
// boundary. `cache()` makes a second call with the same arguments in one render
// pass a no-op (the arguments are primitives on purpose: React compares them by
// identity); prefetch exclusion is the page's and the links' job.

/** One `solicitud.ranking.consultado` row: the dashboard open, as counts only. */
export const recordReportDashboardRead = cache(
  async (
    actorId: number,
    carreraId: number,
    periodo: string | null,
    estudiantes: number,
    docentes: number,
    asignaturas: number,
  ): Promise<void> => {
    await db.transaction(async (tx) => {
      await insertAuditEvents(tx, actorId, [
        solicitudRankingConsultadoEvent({
          carreraId,
          periodo,
          estudiantes,
          docentes,
          asignaturas,
        }),
      ]);
    });
  },
);

/**
 * One `solicitud.reporte.consultado` row: the request detail open, as the
 * applied filters and the total. `busqueda` is only whether a term was typed.
 */
export const recordReportRequestsRead = cache(
  async (
    actorId: number,
    carreraId: number,
    periodo: string,
    docenteId: number | null,
    causa: Causa | null,
    busqueda: boolean,
    total: number,
  ): Promise<void> => {
    await db.transaction(async (tx) => {
      await insertAuditEvents(tx, actorId, [
        solicitudReporteConsultadoEvent({
          carreraId,
          periodo,
          docenteId,
          causa,
          busqueda,
          total,
        }),
      ]);
    });
  },
);

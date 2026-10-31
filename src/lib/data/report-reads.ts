import "server-only";

import { cache } from "react";

import { db } from "@/db";
import { solicitudRankingConsultadoEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";

// Audited coordination report reads (RF-17 e, RNF-06, CR-7). The caller is the
// dashboard `page.tsx` only, after authorisation and after the data loaded, so
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

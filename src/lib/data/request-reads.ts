import "server-only";

import { cache } from "react";

import { db } from "@/db";
import {
  solicitudColaConsultadaEvent,
  solicitudConsultadaEvent,
} from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import type { EstadoSolicitud } from "@/lib/intake/states";

// Audited staff reads (RNF-06 a, SR-11). The callers are the review `page.tsx`
// modules only, after authorisation and after the data loaded, so no data is
// shown without its audit row: a failed insert throws to the error boundary.
// `cache()` makes a second call with the same arguments in one render pass a
// no-op; prefetch exclusion is the page's and the links' job (task 4.9).

/** One `solicitud.consultada` row: a staff open of one request detail. */
export const recordRequestRead = cache(
  async (
    actorId: number,
    solicitudId: number,
    estado: EstadoSolicitud,
  ): Promise<void> => {
    await db.transaction(async (tx) => {
      await insertAuditEvents(tx, actorId, [
        solicitudConsultadaEvent({ solicitudId, estado }),
      ]);
    });
  },
);

/** One `solicitud.cola.consultada` row: the queue open, as a count only. */
export const recordQueueRead = cache(
  async (actorId: number, facultadId: number, total: number): Promise<void> => {
    await db.transaction(async (tx) => {
      await insertAuditEvents(tx, actorId, [
        solicitudColaConsultadaEvent({ facultadId, total }),
      ]);
    });
  },
);

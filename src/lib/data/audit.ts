import "server-only";

import type { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import type { AuditEvent } from "@/lib/audit/types";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";

/**
 * The transaction handle handed to `db.transaction(async (tx) => ...)`. The
 * writer takes this type, not the `db` singleton, so an audit row written
 * outside the change's own transaction is a compile error (decision 23).
 */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Appends audit rows on the caller's transaction, chunked at
 * `WRITE_CHUNK_ROWS`. `actorId` comes from the session, never from an event;
 * `OcurridoEn` and `Id` are never set (column default / identity), so a
 * builder cannot forge the clock.
 */
export async function insertAuditEvents(
  tx: Transaction,
  actorId: number,
  events: readonly AuditEvent[],
): Promise<void> {
  for (let i = 0; i < events.length; i += WRITE_CHUNK_ROWS) {
    const rows = events.slice(i, i + WRITE_CHUNK_ROWS).map((e) => ({
      actorId,
      accion: e.accion,
      entidadTipo: e.entidadTipo,
      entidadId: e.entidadId,
      datos: e.datos,
    }));
    await tx.insert(eventoAuditoria).values(rows);
  }
}

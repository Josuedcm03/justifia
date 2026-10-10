import "server-only";

import { and, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { documentoRespaldo, solicitud } from "@/db/schema";
import { cutoffOf } from "@/lib/data/solicitudes";
import { ORPHAN_GRACE_HOURS, PENDING_GRACE_HOURS } from "@/lib/intake/limits";
import { INTAKE_ROOT_PREFIX } from "@/lib/intake/pathnames";
import type { DocumentStore } from "@/lib/intake/ports";

// Daily cleanup of the intake flow (D8, D14). Three independent steps, each
// idempotent and continuing past a failing item: expired drafts, `pendiente`
// documents left by a failed finalize, and stored files no record references.
// Only `borrador` requests are ever touched, and NO audit row is written: the
// sweep has no human actor and a draft is not yet a presented request (D14).
// Callers report the counts; nothing personal is returned.

const BATCH_SIZE = 100;
/** Hard stop against a runaway loop; a daily run never needs this many. */
const MAX_BATCHES = 50;
const HOUR_MS = 60 * 60 * 1000;

export type SweepCounts = {
  draftsDeleted: number;
  pendingDocumentsDeleted: number;
  orphanBlobsDeleted: number;
  failures: number;
};

/** Delete stored files; a failure is counted, never thrown (rows are gone). */
async function deleteBlobs(
  store: DocumentStore,
  pathnames: readonly string[],
  counts: SweepCounts,
): Promise<boolean> {
  if (pathnames.length === 0) return true;
  try {
    await store.delete(pathnames);
    return true;
  } catch {
    counts.failures += 1;
    return false;
  }
}

/** Rows first (so a retry cannot resurrect them), then files, per draft. */
async function sweepDrafts(now: Date, store: DocumentStore, c: SweepCounts) {
  const expired = and(
    eq(solicitud.estado, "borrador"),
    lte(solicitud.actualizadoEn, cutoffOf(now)),
  );

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const drafts = await db
      .select({ id: solicitud.id })
      .from(solicitud)
      .where(expired)
      .limit(BATCH_SIZE);

    let progress = 0;
    for (const { id } of drafts) {
      try {
        const files = await db
          .select({ pathname: documentoRespaldo.pathname })
          .from(documentoRespaldo)
          .where(eq(documentoRespaldo.solicitudId, id));
        const removed = await db
          .delete(solicitud)
          .where(and(eq(solicitud.id, id), eq(solicitud.estado, "borrador")))
          .returning({ id: solicitud.id });
        if (removed.length === 0) continue;

        progress += 1;
        c.draftsDeleted += 1;
        await deleteBlobs(
          store,
          files.map((f) => f.pathname),
          c,
        );
      } catch {
        c.failures += 1;
      }
    }
    // A short batch is the last; a full one that removed nothing would repeat.
    if (drafts.length < BATCH_SIZE || progress === 0) return;
  }
}

async function sweepPendingDocuments(
  now: Date,
  store: DocumentStore,
  c: SweepCounts,
) {
  const stale = and(
    eq(documentoRespaldo.estado, "pendiente"),
    lte(
      documentoRespaldo.creadoEn,
      new Date(now.getTime() - PENDING_GRACE_HOURS * HOUR_MS),
    ),
    eq(solicitud.estado, "borrador"),
  );

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const docs = await db
      .select({
        id: documentoRespaldo.id,
        pathname: documentoRespaldo.pathname,
      })
      .from(documentoRespaldo)
      .innerJoin(solicitud, eq(solicitud.id, documentoRespaldo.solicitudId))
      .where(stale)
      .limit(BATCH_SIZE);
    if (docs.length === 0) return;

    try {
      await db.delete(documentoRespaldo).where(
        inArray(
          documentoRespaldo.id,
          docs.map((d) => d.id),
        ),
      );
    } catch {
      c.failures += 1;
      return;
    }
    c.pendingDocumentsDeleted += docs.length;
    await deleteBlobs(
      store,
      docs.map((d) => d.pathname),
      c,
    );
    if (docs.length < BATCH_SIZE) return;
  }
}

/** Files under the draft prefix that are old enough and have no record. */
async function sweepOrphans(now: Date, store: DocumentStore, c: SweepCounts) {
  const cutoff = now.getTime() - ORPHAN_GRACE_HOURS * HOUR_MS;
  let cursor: string | undefined;

  try {
    do {
      const page = await store.list(INTAKE_ROOT_PREFIX, cursor);
      cursor = page.cursor;

      const old = page.blobs
        .filter((b) => b.uploadedAt.getTime() <= cutoff)
        .map((b) => b.pathname);
      if (old.length === 0) continue;

      const referenced = await db
        .select({ pathname: documentoRespaldo.pathname })
        .from(documentoRespaldo)
        .where(inArray(documentoRespaldo.pathname, old));
      const kept = new Set(referenced.map((r) => r.pathname));
      const orphans = old.filter((pathname) => !kept.has(pathname));

      if (orphans.length > 0 && (await deleteBlobs(store, orphans, c))) {
        c.orphanBlobsDeleted += orphans.length;
      }
    } while (cursor);
  } catch {
    c.failures += 1;
  }
}

/** Run the three steps in order. `now` and `store` come from the caller. */
export async function runIntakeSweep(
  now: Date,
  store: DocumentStore,
): Promise<SweepCounts> {
  const counts: SweepCounts = {
    draftsDeleted: 0,
    pendingDocumentsDeleted: 0,
    orphanBlobsDeleted: 0,
    failures: 0,
  };

  for (const step of [sweepDrafts, sweepPendingDocuments, sweepOrphans]) {
    try {
      await step(now, store, counts);
    } catch {
      counts.failures += 1;
    }
  }
  return counts;
}

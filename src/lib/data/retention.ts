import "server-only";

import { and, asc, count, eq, gt, isNull, lte, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  documentoRespaldo,
  escalamiento,
  inscripcion,
  remision,
  reporteInasistencia,
  rol,
  solicitud,
  solicitudDecision,
  usuario,
} from "@/db/schema";
import { accountCancelledEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import type { DocumentStore } from "@/lib/intake/ports";
import {
  CANCELLED_HASH,
  CANCELLED_TEXT,
  SYSTEM_HASH,
  SYSTEM_LOGIN,
  cancelledLogin,
  retentionCutoff,
} from "@/lib/retention/policy";
import type { RolUsuario } from "@/lib/validations/auth";

// Data retention (RNF-04, RN-27): a student is cancelled five years after the
// last activity unless enrolled. Cancelling anonymizes in place (the account is
// pinned by its own requests, enrollments and audit rows), deletes the
// supporting documents and writes one audit row, all in ONE transaction per
// student. Stored files go after the commit, so a rolled-back student keeps
// them; a failed file delete is counted and left to the orphan sweep (DR-7).
// `now` and `store` come from the caller. Counts are the only thing returned.

/** Students per read, and reads per run: 500 a day at most (D5). The backlog
 *  drains on later days. */
export const BATCH_SIZE = 50;
export const MAX_BATCHES = 10;

const STUDENT_ROLE: RolUsuario = "estudiante";

export type RetentionCounts = {
  dryRun: boolean;
  due: number;
  cancelled: number;
  documentsDeleted: number;
  blobsDeleted: number;
  failures: number;
};

/** The free-text rule (D3): a value becomes the placeholder, NULL stays NULL,
 *  so every CHECK on the column holds in both branches. */
function redact(column: AnyPgColumn) {
  return sql`CASE WHEN ${column} IS NULL THEN NULL ELSE ${CANCELLED_TEXT}::text END`;
}

/** The rows of `column` that belong to the student's requests, drafts included. */
function ofStudent(column: AnyPgColumn, studentId: number) {
  return sql`${column} IN (SELECT ${solicitud.id} FROM ${solicitud} WHERE ${solicitud.estudianteId} = ${studentId})`;
}

/**
 * The one due rule (DR-1, DR-2), shared by the count, the selection and the
 * guarded write, so they cannot disagree. Role "estudiante" only, never
 * cancelled, account old enough, no active enrollment, and no request
 * presented or resubmitted after the cutoff (`greatest` ignores NULLs).
 */
function due(cutoff: Date) {
  return and(
    sql`${usuario.rolId} IN (SELECT ${rol.id} FROM ${rol} WHERE ${rol.codigo} = ${STUDENT_ROLE})`,
    isNull(usuario.canceladoEn),
    lte(usuario.creadoEn, cutoff),
    sql`NOT EXISTS (SELECT 1 FROM ${inscripcion} WHERE ${inscripcion.estudianteId} = ${usuario.id} AND ${inscripcion.activo})`,
    sql`NOT EXISTS (SELECT 1 FROM ${solicitud} WHERE ${solicitud.estudianteId} = ${usuario.id} AND greatest(${solicitud.presentadaEn}, ${solicitud.reenviadaEn}) > ${cutoff.toISOString()}::timestamptz)`,
  );
}

/** The sentinel account that signs the audit rows. A missing one throws, so
 *  the run fails closed instead of writing rows under a wrong actor (D2). */
async function findSystemActor(): Promise<number> {
  const [row] = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(
      and(
        eq(usuario.login, SYSTEM_LOGIN),
        eq(usuario.hashClave, SYSTEM_HASH),
        eq(usuario.activo, false),
      ),
    )
    .limit(1);
  if (!row) throw new Error("retention system actor not found");
  return row.id;
}

async function countDue(cutoff: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(usuario)
    .where(due(cutoff));
  return row?.n ?? 0;
}

/** Keyset on `Id`, so a student that keeps failing cannot be read again. */
async function dueAfter(cutoff: Date, lastId: number): Promise<number[]> {
  const rows = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(due(cutoff), gt(usuario.id, lastId)))
    .orderBy(asc(usuario.id))
    .limit(BATCH_SIZE);
  return rows.map((r) => r.id);
}

/**
 * One student, one transaction. The first statement rechecks the due rule, so a
 * student who enrolled or filed a request since the selection is skipped with
 * no other write (D4). Returns the pathnames of the deleted documents, or null
 * when the student was skipped.
 */
async function cancelStudent(
  id: number,
  now: Date,
  cutoff: Date,
  actorId: number,
): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    const guarded = await tx
      .update(usuario)
      .set({
        nombreCompleto: CANCELLED_TEXT,
        login: cancelledLogin(id),
        correo: null,
        telefono: null,
        cif: null,
        hashClave: CANCELLED_HASH,
        activo: false,
        debeCambiarClave: false,
        canceladoEn: now,
      })
      .where(and(eq(usuario.id, id), due(cutoff)))
      .returning({ id: usuario.id });
    if (guarded.length === 0) return null;

    const files = await tx
      .select({ pathname: documentoRespaldo.pathname })
      .from(documentoRespaldo)
      .where(ofStudent(documentoRespaldo.solicitudId, id));

    const requests = await tx
      .update(solicitud)
      .set({
        estudianteNombre: redact(solicitud.estudianteNombre),
        estudianteCif: redact(solicitud.estudianteCif),
        estudianteCarrera: redact(solicitud.estudianteCarrera),
        estudianteCorreo: redact(solicitud.estudianteCorreo),
        canceladaEn: now,
      })
      .where(eq(solicitud.estudianteId, id))
      .returning({ id: solicitud.id });
    await tx
      .update(solicitudDecision)
      .set({ texto: redact(solicitudDecision.texto) })
      .where(ofStudent(solicitudDecision.solicitudId, id));
    await tx
      .update(remision)
      .set({
        docenteNombre: CANCELLED_TEXT,
        correo: redact(remision.correo),
      })
      .where(ofStudent(remision.solicitudId, id));
    await tx
      .update(reporteInasistencia)
      .set({
        docenteNombre: CANCELLED_TEXT,
        nota: redact(reporteInasistencia.nota),
      })
      .where(ofStudent(reporteInasistencia.solicitudId, id));
    await tx
      .update(escalamiento)
      .set({
        nota: redact(escalamiento.nota),
        respuesta: redact(escalamiento.respuesta),
      })
      .where(ofStudent(escalamiento.solicitudId, id));
    await tx
      .delete(documentoRespaldo)
      .where(ofStudent(documentoRespaldo.solicitudId, id));

    await insertAuditEvents(tx, actorId, [
      accountCancelledEvent({
        usuarioId: id,
        solicitudes: requests.length,
        documentos: files.length,
      }),
    ]);
    return files.map((f) => f.pathname);
  });
}

/**
 * Cancel the students due at `now`, at most `BATCH_SIZE * MAX_BATCHES` per run.
 * A dry run reads only. A student whose transaction fails is rolled back whole,
 * counted, and the run carries on with the next one.
 */
export async function runRetention(
  now: Date,
  store: DocumentStore,
  options: { dryRun?: boolean } = {},
): Promise<RetentionCounts> {
  const dryRun = options.dryRun ?? false;
  const actorId = await findSystemActor();
  const cutoff = retentionCutoff(now);
  const counts: RetentionCounts = {
    dryRun,
    due: await countDue(cutoff),
    cancelled: 0,
    documentsDeleted: 0,
    blobsDeleted: 0,
    failures: 0,
  };
  if (dryRun) return counts;

  let lastId = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const ids = await dueAfter(cutoff, lastId);
    for (const id of ids) {
      lastId = id;
      let pathnames: string[] | null;
      try {
        pathnames = await cancelStudent(id, now, cutoff, actorId);
      } catch {
        counts.failures += 1;
        continue;
      }
      if (pathnames === null) continue;

      counts.cancelled += 1;
      counts.documentsDeleted += pathnames.length;
      if (pathnames.length === 0) continue;
      try {
        await store.delete(pathnames);
        counts.blobsDeleted += pathnames.length;
      } catch {
        counts.failures += 1;
      }
    }
    // A short batch is the last one.
    if (ids.length < BATCH_SIZE) break;
  }
  return counts;
}

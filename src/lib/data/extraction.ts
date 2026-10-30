import "server-only";

import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { QueryBuilder, type PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento, solicitud } from "@/db/schema";
import type { ExtractionRowView } from "@/lib/extraction/display";
import { CLAIM_LEASE_MS, MAX_ATTEMPTS } from "@/lib/extraction/limits";
import { failureOutcome, type ExtractionError } from "@/lib/extraction/states";
import type { ValidatedFields } from "@/lib/extraction/validate";

// The ONLY module that writes `ExtraccionDocumento` (document-extraction, DE-1):
// registration, the guarded claim, the guarded completions and the sweep's
// reads and abandon step. A structural test pins it. It writes no audit row
// (extraction has no human actor, D14) and logs only ids, states, codes and
// counts, never a pathname, a name or an extracted value (RNF-04).

function leaseCutoff(now: Date): Date {
  return new Date(now.getTime() - CLAIM_LEASE_MS);
}

/** A row the worker may take: pending, or processing with an expired lease. */
function claimableRow(now: Date) {
  return and(
    lt(extraccionDocumento.intentos, MAX_ATTEMPTS),
    or(
      eq(extraccionDocumento.estado, "pendiente"),
      and(
        eq(extraccionDocumento.estado, "procesando"),
        lt(extraccionDocumento.reclamadaEn, leaseCutoff(now)),
      ),
    ),
  );
}

/**
 * Idempotent registration for one request (DE-5), in one transaction. Every
 * finalized student document without a row gets one: `pendiente`, or
 * `no_aplica` when it is already retired. An existing row is never touched
 * (`ON CONFLICT DO NOTHING`), so `completada` and `fallida` stay final; the
 * open rows of documents retired meanwhile become `no_aplica`. Returns the ids
 * a worker may claim now, ordered by id.
 */
export async function registerPendingExtractions(
  solicitudId: number,
  now: Date = new Date(),
): Promise<number[]> {
  return db.transaction(async (tx) => {
    const documents = await tx
      .select({
        id: documentoRespaldo.id,
        retiradoEn: documentoRespaldo.retiradoEn,
      })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.solicitudId, solicitudId),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.subidoPorId),
          eq(documentoRespaldo.formatoEspecial, false),
        ),
      );
    if (documents.length > 0) {
      await tx
        .insert(extraccionDocumento)
        .values(
          documents.map((d) => ({
            documentoId: d.id,
            estado:
              d.retiradoEn === null
                ? ("pendiente" as const)
                : ("no_aplica" as const),
          })),
        )
        .onConflictDoNothing();
    }
    await tx
      .update(extraccionDocumento)
      .set({
        estado: "no_aplica",
        reclamoId: null,
        reclamadaEn: null,
        actualizadaEn: now,
      })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.id, extraccionDocumento.documentoId),
          eq(documentoRespaldo.solicitudId, solicitudId),
          isNotNull(documentoRespaldo.retiradoEn),
          inArray(extraccionDocumento.estado, ["pendiente", "procesando"]),
        ),
      );
    const claimable = await tx
      .select({ documentoId: extraccionDocumento.documentoId })
      .from(extraccionDocumento)
      .innerJoin(
        documentoRespaldo,
        eq(documentoRespaldo.id, extraccionDocumento.documentoId),
      )
      .where(
        and(
          eq(documentoRespaldo.solicitudId, solicitudId),
          isNull(documentoRespaldo.retiradoEn),
          claimableRow(now),
        ),
      )
      .orderBy(asc(extraccionDocumento.documentoId));
    return claimable.map((r) => r.documentoId);
  });
}

/** A document as the worker sees it right after winning the claim. */
export type ExtractionClaim = {
  documentoId: number;
  pathname: string;
  tipoDetectado: "pdf" | "png" | "jpeg";
  /** Attempts including this one. */
  intentos: number;
  reclamoId: string;
  /** Instant the request's clock started: `ReenviadaEn ?? PresentadaEn`. */
  submittedAt: Date;
};

/**
 * Guarded claim of one document (DE-3, DE-6): `UPDATE ... FROM ... RETURNING`.
 * Matches a pending row, or a processing row whose lease expired, under the
 * attempt cap, of a document that is not retired and a request that was
 * presented. Null means another worker holds it, it is final, or nothing is
 * left to do: skip silently.
 */
export async function claimExtraction(
  documentoId: number,
  now: Date = new Date(),
): Promise<ExtractionClaim | null> {
  const [claimed] = await db
    .update(extraccionDocumento)
    .set({
      estado: "procesando",
      reclamoId: randomUUID(),
      reclamadaEn: now,
      intentos: sql`${extraccionDocumento.intentos} + 1`,
      actualizadaEn: now,
    })
    .from(documentoRespaldo)
    .innerJoin(solicitud, eq(solicitud.id, documentoRespaldo.solicitudId))
    .where(
      and(
        eq(extraccionDocumento.documentoId, documentoId),
        eq(documentoRespaldo.id, extraccionDocumento.documentoId),
        isNull(documentoRespaldo.retiradoEn),
        isNotNull(solicitud.presentadaEn),
        claimableRow(now),
      ),
    )
    .returning({
      documentoId: extraccionDocumento.documentoId,
      pathname: documentoRespaldo.pathname,
      tipoDetectado: documentoRespaldo.tipoDetectado,
      intentos: extraccionDocumento.intentos,
      reclamoId: extraccionDocumento.reclamoId,
      reenviadaEn: solicitud.reenviadaEn,
      presentadaEn: solicitud.presentadaEn,
    });
  if (!claimed) return null;
  return {
    documentoId: claimed.documentoId,
    pathname: claimed.pathname,
    tipoDetectado: claimed.tipoDetectado as ExtractionClaim["tipoDetectado"],
    intentos: claimed.intentos,
    reclamoId: claimed.reclamoId as string,
    submittedAt: (claimed.reenviadaEn ?? claimed.presentadaEn) as Date,
  };
}

/** Matches the row only while this worker still holds its claim (DE-3). */
function heldBy(claim: ExtractionClaim) {
  return and(
    eq(extraccionDocumento.documentoId, claim.documentoId),
    eq(extraccionDocumento.reclamoId, claim.reclamoId),
    eq(extraccionDocumento.estado, "procesando"),
  );
}

/**
 * One guarded completion. A worker whose lease was taken over matches no row,
 * writes nothing and gets `false`. The claim is always released.
 */
async function finish(
  claim: ExtractionClaim,
  set: PgUpdateSetSource<typeof extraccionDocumento>,
): Promise<boolean> {
  const updated = await db
    .update(extraccionDocumento)
    .set(set)
    .where(heldBy(claim))
    .returning({ documentoId: extraccionDocumento.documentoId });
  return updated.length > 0;
}

/**
 * The attempt succeeded. An answer with no recognized value is still a
 * completion: every field stays NULL ("no reconocido", RF-11 b).
 */
export function completeExtraction(
  claim: ExtractionClaim,
  fields: ValidatedFields,
  motor: string,
  now: Date = new Date(),
): Promise<boolean> {
  return finish(claim, {
    estado: "completada",
    nombreEstudiante: fields.studentName,
    emisor: fields.issuer,
    fechaEmision: fields.issueDate,
    reposoDesde: fields.restFrom,
    reposoHasta: fields.restTo,
    reposoDias: fields.restDays,
    motor,
    errorCodigo: null,
    procesadoEn: now,
    reclamoId: null,
    reclamadaEn: null,
    actualizadaEn: now,
  });
}

/**
 * The attempt failed with a closed-set code (never free text). Below the cap
 * and not permanent the row goes back to `pendiente`; otherwise it is
 * `fallida` with the time of the outcome. A `not_configured` claim is handed
 * back and its attempt returned, so rows wait for the setting without burning
 * the cap (DE-4).
 */
export function failExtraction(
  claim: ExtractionClaim,
  error: ExtractionError,
  now: Date = new Date(),
): Promise<boolean> {
  const estado = failureOutcome(error, claim.intentos);
  return finish(claim, {
    estado,
    errorCodigo: error,
    ...(error === "not_configured"
      ? { intentos: sql`greatest(${extraccionDocumento.intentos} - 1, 0)` }
      : {}),
    ...(estado === "fallida" ? { procesadoEn: now } : {}),
    reclamoId: null,
    reclamadaEn: null,
    actualizadaEn: now,
  });
}

/**
 * Sweep step 4, first part (DE-3): a processing row whose lease expired after
 * its last attempt can never be claimed again, so it ends as `fallida` with
 * `timeout`. Returns how many rows it closed.
 */
export async function abandonExpiredExtractions(
  now: Date = new Date(),
): Promise<number> {
  const closed = await db
    .update(extraccionDocumento)
    .set({
      estado: "fallida",
      errorCodigo: "timeout",
      procesadoEn: now,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: now,
    })
    .where(
      and(
        eq(extraccionDocumento.estado, "procesando"),
        lt(extraccionDocumento.reclamadaEn, leaseCutoff(now)),
        gte(extraccionDocumento.intentos, MAX_ATTEMPTS),
      ),
    )
    .returning({ documentoId: extraccionDocumento.documentoId });
  return closed.length;
}

// Subqueries are built without a connection, so they never consume a statement.
const subquery = new QueryBuilder();

/**
 * Pending requests with work left for the sweep (DE-11): a `pendiente` row, a
 * processing row whose lease expired, or an eligible document with no row at
 * all, oldest clock start first, at most `limit`. Requests in any other state
 * and rows that are final never qualify. A bounded batch per run is the
 * backfill of requests that were pending before extraction existed.
 */
export async function selectExtractionCandidates(
  now: Date,
  limit: number,
): Promise<number[]> {
  const openRow = subquery
    .select({ one: sql`1` })
    .from(extraccionDocumento)
    .innerJoin(
      documentoRespaldo,
      eq(documentoRespaldo.id, extraccionDocumento.documentoId),
    )
    .where(
      and(
        eq(documentoRespaldo.solicitudId, solicitud.id),
        isNull(documentoRespaldo.retiradoEn),
        claimableRow(now),
      ),
    );
  const unregistered = subquery
    .select({ one: sql`1` })
    .from(documentoRespaldo)
    .where(
      and(
        eq(documentoRespaldo.solicitudId, solicitud.id),
        eq(documentoRespaldo.estado, "valido"),
        isNull(documentoRespaldo.retiradoEn),
        isNull(documentoRespaldo.subidoPorId),
        eq(documentoRespaldo.formatoEspecial, false),
        notExists(
          subquery
            .select({ one: sql`1` })
            .from(extraccionDocumento)
            .where(eq(extraccionDocumento.documentoId, documentoRespaldo.id)),
        ),
      ),
    );
  const rows = await db
    .select({ id: solicitud.id })
    .from(solicitud)
    .where(
      and(
        eq(solicitud.estado, "pendiente"),
        or(exists(openRow), exists(unregistered)),
      ),
    )
    .orderBy(
      asc(sql`coalesce(${solicitud.reenviadaEn}, ${solicitud.presentadaEn})`),
      asc(solicitud.id),
    )
    .limit(limit);
  return rows.map((r) => r.id);
}

/** One current student document of a request and what was read from it. */
export type ExtractionListItem = {
  documentoId: number;
  nombreOriginal: string;
  /** Null when the document has no row yet. */
  row: ExtractionRowView | null;
};

export type ExtractionList = {
  data: ExtractionListItem[];
  /** True when the read failed: show one notice, never partial entries. */
  degraded: boolean;
};

/**
 * The staff read model (DE-13): one entry per current, finalized student
 * document of a request. A document without a row appears (left join); retired
 * documents and `no_aplica` rows do not. Fail-soft: a failed query is an empty,
 * degraded result so the rest of the detail still renders. The caller has
 * already proven the request is in scope.
 */
export async function listExtractions(
  solicitudId: number,
): Promise<ExtractionList> {
  try {
    const rows = await db
      .select({
        documentoId: documentoRespaldo.id,
        nombreOriginal: documentoRespaldo.nombreOriginal,
        estado: extraccionDocumento.estado,
        nombreEstudiante: extraccionDocumento.nombreEstudiante,
        emisor: extraccionDocumento.emisor,
        fechaEmision: extraccionDocumento.fechaEmision,
        reposoDesde: extraccionDocumento.reposoDesde,
        reposoHasta: extraccionDocumento.reposoHasta,
        reposoDias: extraccionDocumento.reposoDias,
      })
      .from(documentoRespaldo)
      .leftJoin(
        extraccionDocumento,
        eq(extraccionDocumento.documentoId, documentoRespaldo.id),
      )
      .where(
        and(
          eq(documentoRespaldo.solicitudId, solicitudId),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.retiradoEn),
          isNull(documentoRespaldo.subidoPorId),
          or(
            isNull(extraccionDocumento.estado),
            ne(extraccionDocumento.estado, "no_aplica"),
          ),
        ),
      )
      .orderBy(asc(documentoRespaldo.id));
    return {
      degraded: false,
      data: rows.map((r) => ({
        documentoId: r.documentoId,
        nombreOriginal: r.nombreOriginal,
        row:
          r.estado === null
            ? null
            : {
                state: r.estado as ExtractionRowView["state"],
                studentName: r.nombreEstudiante,
                issuer: r.emisor,
                issueDate: r.fechaEmision,
                restFrom: r.reposoDesde,
                restTo: r.reposoHasta,
                restDays: r.reposoDias,
              },
      })),
    };
  } catch (error) {
    console.error("extraction_read_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { data: [], degraded: true };
  }
}

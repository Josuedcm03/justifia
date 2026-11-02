import "server-only";

import { and, eq, exists, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { QueryBuilder, alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  documentoRespaldo,
  extraccionDocumento,
  grupo,
  solicitud,
  solicitudAsignatura,
} from "@/db/schema";
import { listExtractions } from "@/lib/data/extraction";
import { calendar as defaultCalendar } from "@/lib/intake/calendar";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";
import type { RequestScope } from "@/lib/intake/request-scope";
import { evaluateSignals } from "@/lib/signals/evaluate";
import { DEFAULT_SIGNAL_PARAMS, type SignalParams } from "@/lib/signals/params";
import type { IssuerHistoryRow, SignalReport } from "@/lib/signals/types";

// The ONLY data module that reads the validation signals (RF-05, RN-15). It
// assembles plain data with read-only queries and hands it to the pure
// evaluators; it writes nothing and adds no audit row (the page's single
// `solicitud.consultada` is the only one). A structural test pins that no write
// path imports it (VS-2). Fail-soft (VS-3): any failure is one degraded result,
// never a partial verdict. It logs the error name only (RNF-04).

export type SignalsRead = {
  data: SignalReport | null;
  /** True when the read failed: show one notice, never a partial verdict. */
  degraded: boolean;
};

export type LoadSignalsInput = {
  solicitudId: number;
  /**
   * Scope that decides which other request numbers may be named. S1 has no
   * reference to name (RN-26 arrives in S2), so it is accepted and unused.
   */
  referenceScope: RequestScope;
  params?: SignalParams;
  calendar?: NonWorkingDaysProvider;
};

type RequestBase = {
  presentadaEn: Date;
  fechaInicio: string;
  fechaFin: string;
  estudianteId: number;
};

/** Q1: the request's own dates and student. */
export async function readRequestBase(
  solicitudId: number,
): Promise<RequestBase> {
  const [row] = await db
    .select({
      presentadaEn: solicitud.presentadaEn,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      estudianteId: solicitud.estudianteId,
    })
    .from(solicitud)
    .where(eq(solicitud.id, solicitudId))
    .limit(1);
  // A presented request always has all three; anything else is a read failure,
  // never a reason code.
  if (!row?.presentadaEn || !row.fechaInicio || !row.fechaFin) {
    throw new Error("signals_request_incomplete");
  }
  return {
    presentadaEn: row.presentadaEn,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    estudianteId: row.estudianteId,
  };
}

/** Q3: the distinct academic periods of the request's subjects. */
export async function readPeriods(solicitudId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ periodo: grupo.periodo })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .where(eq(solicitudAsignatura.solicitudId, solicitudId));
  return rows.map((r) => r.periodo);
}

// R, the request being read, as a second reference to `Solicitud`: the order of
// presentation is compared inside the database, so no timestamp is rounded in
// the driver.
const reference = alias(solicitud, "r");
// Built without a connection, so it never consumes a statement.
const subquery = new QueryBuilder();

/**
 * Q4: the raw issuers of the earlier presented requests of the same student
 * that have a subject in the period (RN-14). Earlier means `(PresentadaEn, Id)`
 * below R's, so a later request never changes an earlier result. There is no
 * state filter: `rechazada` and `devuelta` requests count, a draft has no
 * `PresentadaEn`. Only current student documents with a completed extraction
 * and an issuer count. Normalization happens in TypeScript.
 */
export async function readIssuerHistory(input: {
  solicitudId: number;
  estudianteId: number;
  period: string;
}): Promise<IssuerHistoryRow[]> {
  const inPeriod = subquery
    .select({ one: sql`1` })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .where(
      and(
        eq(solicitudAsignatura.solicitudId, solicitud.id),
        eq(grupo.periodo, input.period),
      ),
    );
  const rows = await db
    .select({
      solicitudId: solicitud.id,
      emisor: extraccionDocumento.emisor,
    })
    .from(solicitud)
    .innerJoin(
      documentoRespaldo,
      eq(documentoRespaldo.solicitudId, solicitud.id),
    )
    .innerJoin(
      extraccionDocumento,
      eq(extraccionDocumento.documentoId, documentoRespaldo.id),
    )
    .where(
      and(
        eq(solicitud.estudianteId, input.estudianteId),
        ne(solicitud.id, input.solicitudId),
        isNotNull(solicitud.presentadaEn),
        sql`(${solicitud.presentadaEn}, ${solicitud.id}) < ${subquery
          .select({ at: reference.presentadaEn, id: reference.id })
          .from(reference)
          .where(eq(reference.id, input.solicitudId))}`,
        exists(inPeriod),
        eq(documentoRespaldo.estado, "valido"),
        isNull(documentoRespaldo.retiradoEn),
        isNull(documentoRespaldo.subidoPorId),
        eq(documentoRespaldo.formatoEspecial, false),
        eq(extraccionDocumento.estado, "completada"),
        isNotNull(extraccionDocumento.emisor),
      ),
    );
  return rows.flatMap((r) =>
    r.emisor === null ? [] : [{ solicitudId: r.solicitudId, issuer: r.emisor }],
  );
}

/**
 * Reads and evaluates the signals of one request, computed on every read from
 * current data (SNAP). The caller has already proven the request is in its
 * scope. Never throws: a failure of any query, or a degraded extraction read,
 * is `{ data: null, degraded: true }`.
 */
export async function loadSignals({
  solicitudId,
  params = DEFAULT_SIGNAL_PARAMS,
  calendar = defaultCalendar,
}: LoadSignalsInput): Promise<SignalsRead> {
  try {
    const base = await readRequestBase(solicitudId);
    const extractions = await listExtractions(solicitudId);
    if (extractions.degraded) return { data: null, degraded: true };

    const periods = await readPeriods(solicitudId);
    const issuerHistory =
      periods.length === 1
        ? await readIssuerHistory({
            solicitudId,
            estudianteId: base.estudianteId,
            period: periods[0],
          })
        : [];

    return {
      degraded: false,
      data: evaluateSignals(
        {
          solicitudId,
          presentedAt: base.presentadaEn,
          absenceFrom: base.fechaInicio,
          absenceTo: base.fechaFin,
          documents: extractions.data.map((item) => ({
            documentId: item.documentoId,
            extraction: item.row,
          })),
          periods,
          issuerHistory,
        },
        params,
        calendar,
      ),
    };
  } catch (error) {
    console.error("signals_read_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { data: null, degraded: true };
  }
}

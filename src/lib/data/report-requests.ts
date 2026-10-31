import "server-only";

import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  asignatura,
  grupo,
  solicitud,
  solicitudAsignatura,
  usuario,
} from "@/db/schema";
import {
  listReportPeriods,
  type RankingSource,
} from "@/lib/data/report-rankings";
import {
  buildReportWhere,
  type ReportFilters,
} from "@/lib/data/report-scope-sql";
import { clampPage } from "@/lib/data/users";
import { VISIBLE_STATES } from "@/lib/intake/states";
import { REPORT_PAGE_SIZE } from "@/lib/reports/constants";
import type { ReportScope } from "@/lib/reports/scope";

// The request detail of the coordination reports (CR-DET-1..3). Every query
// shares `buildReportWhere` with the rankings, so the same filters give the same
// requests everywhere. The count and the page have no pair join: a request is
// one row however many classes it holds, and the classes of the listed page are
// read once, in a batch.

const teacher = alias(usuario, "d");

export type ReportRequestRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  causa: string | null;
  estado: string;
  /** Calendar dates (`YYYY-MM-DD`). */
  fechaInicio: string | null;
  fechaFin: string | null;
  presentadaEn: Date | null;
};

/** One justified class of a request, with the live teacher and the period. */
export type ReportClass = {
  solicitudId: number;
  codigo: string;
  asignatura: string;
  periodo: string;
  docente: string;
};

export type ReportDocente = { id: number; name: string };

/** `count(*)` of the requests matching the filters (requests, not pairs). */
export function requestsCountQuery(
  source: RankingSource,
  scope: ReportScope,
  filters: ReportFilters,
) {
  return source
    .select({ total: count() })
    .from(solicitud)
    .where(buildReportWhere(scope, filters, VISIBLE_STATES));
}

/** The requests matching the filters, newest submission first, then the highest id (A-SORT). */
function orderedRequestsQuery(
  source: RankingSource,
  scope: ReportScope,
  filters: ReportFilters,
) {
  return source
    .select({
      id: solicitud.id,
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      causa: solicitud.causa,
      estado: solicitud.estado,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      presentadaEn: solicitud.presentadaEn,
    })
    .from(solicitud)
    .where(buildReportWhere(scope, filters, VISIBLE_STATES))
    .orderBy(desc(solicitud.presentadaEn), desc(solicitud.id));
}

/** One page of the ordered requests. */
export function requestsPageQuery(
  source: RankingSource,
  scope: ReportScope,
  filters: ReportFilters,
  page: number,
) {
  return orderedRequestsQuery(source, scope, filters)
    .limit(REPORT_PAGE_SIZE)
    .offset((page - 1) * REPORT_PAGE_SIZE);
}

/**
 * Every matching request, no LIMIT: the workbook holds all pages (CR-XLS-2). It
 * shares the where of the count, so the file and the screen total agree (CR-XLS-3).
 */
export function requestsExportQuery(
  source: RankingSource,
  scope: ReportScope,
  filters: ReportFilters,
) {
  return orderedRequestsQuery(source, scope, filters);
}

/**
 * Every pair of the given requests with its teacher and period, in ONE query.
 * The ids come from a scoped page, so no scope term is needed here; the period
 * and teacher filters do not apply (CR-DET-1: filtering never hides a class of
 * a listed request).
 */
export function classesQuery(
  source: RankingSource,
  solicitudIds: readonly number[],
) {
  return source
    .select({
      solicitudId: solicitudAsignatura.solicitudId,
      codigo: asignatura.codigo,
      asignatura: asignatura.nombre,
      periodo: grupo.periodo,
      docente: teacher.nombreCompleto,
    })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .innerJoin(teacher, eq(teacher.id, grupo.docenteId))
    .where(inArray(solicitudAsignatura.solicitudId, [...solicitudIds]))
    .orderBy(
      asc(solicitudAsignatura.solicitudId),
      asc(grupo.periodo),
      asc(asignatura.nombre),
      asc(grupo.id),
    );
}

/** The teachers with a pair in a request of the scope: the filter options. */
export function docentesQuery(source: RankingSource, scope: ReportScope) {
  return source
    .selectDistinct({ id: teacher.id, name: teacher.nombreCompleto })
    .from(solicitud)
    .innerJoin(
      solicitudAsignatura,
      eq(solicitudAsignatura.solicitudId, solicitud.id),
    )
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .innerJoin(teacher, eq(teacher.id, grupo.docenteId))
    .where(buildReportWhere(scope, { periodo: null }, VISIBLE_STATES))
    .orderBy(asc(teacher.nombreCompleto), asc(teacher.id));
}

export type ReportRequestsPage = {
  rows: ReportRequestRow[];
  /** Requests matching the filters, not pairs. */
  total: number;
  /** The page actually read, clamped to the last one. */
  page: number;
  pageSize: number;
};

/** The count and one clamped page. A failed read propagates (see the loader). */
export async function listReportRequests(
  scope: ReportScope,
  filters: ReportFilters,
  requestedPage: number,
): Promise<ReportRequestsPage> {
  const [{ total }] = await requestsCountQuery(db, scope, filters);
  const page = clampPage(requestedPage, total, REPORT_PAGE_SIZE);
  if (total === 0) {
    return { rows: [], total, page, pageSize: REPORT_PAGE_SIZE };
  }
  const rows = await requestsPageQuery(db, scope, filters, page);
  return { rows, total, page, pageSize: REPORT_PAGE_SIZE };
}

/** The classes of the listed requests: no query when there are none. */
export async function listReportClasses(
  solicitudIds: readonly number[],
): Promise<ReportClass[]> {
  if (solicitudIds.length === 0) return [];
  return classesQuery(db, solicitudIds);
}

export async function listReportDocentes(
  scope: ReportScope,
): Promise<ReportDocente[]> {
  return docentesQuery(db, scope);
}

export type ReportRequestView = ReportRequestRow & {
  classes: ReportClass[];
};

export type ReportRequestsView = Omit<ReportRequestsPage, "rows"> & {
  rows: ReportRequestView[];
  /** Periods with in-scope requests, newest first (the period options). */
  periods: string[];
  /** Teachers with a pair in the scope (the teacher options). */
  docentes: ReportDocente[];
  degraded: boolean;
};

const DEGRADED: ReportRequestsView = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: REPORT_PAGE_SIZE,
  periods: [],
  docentes: [],
  degraded: true,
};

/**
 * The whole detail read (CR-8). All-or-nothing, like the dashboard: the count and
 * the page, then the classes of the page together with the filter options, inside
 * one `try`. Any failure is `degraded` with no partial data, never a thrown error.
 */
export async function loadReportRequests(
  scope: ReportScope,
  filters: ReportFilters,
  requestedPage: number,
): Promise<ReportRequestsView> {
  try {
    const list = await listReportRequests(scope, filters, requestedPage);
    const [classes, periods, docentes] = await Promise.all([
      listReportClasses(list.rows.map((row) => row.id)),
      listReportPeriods(scope),
      listReportDocentes(scope),
    ]);
    const byRequest = Map.groupBy(classes, (row) => row.solicitudId);
    return {
      ...list,
      rows: list.rows.map((row) => ({
        ...row,
        classes: byRequest.get(row.id) ?? [],
      })),
      periods,
      docentes,
      degraded: false,
    };
  } catch {
    return DEGRADED;
  }
}

/**
 * Every request matching the filters with its classes, for the workbook: no
 * paging, and the classes of all of them in ONE batch. Unlike the detail it is
 * not fail-soft: a failed read throws and the route answers without a file.
 */
export async function listReportExport(
  scope: ReportScope,
  filters: ReportFilters,
): Promise<ReportRequestView[]> {
  const rows = await requestsExportQuery(db, scope, filters);
  const classes = await listReportClasses(rows.map((row) => row.id));
  const byRequest = Map.groupBy(classes, (row) => row.solicitudId);
  return rows.map((row) => ({ ...row, classes: byRequest.get(row.id) ?? [] }));
}

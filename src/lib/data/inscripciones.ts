import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  asignatura,
  grupo,
  inscripcion,
  solicitud,
  solicitudAsignatura,
  usuario,
} from "@/db/schema";
import type {
  InscripcionesListResult,
  InscripcionStatusFilter,
} from "@/lib/catalog/types";
import {
  INSCRIPCIONES_DEFAULT_SORT,
  type InscripcionesSortKey,
} from "@/lib/catalog/list-params";
import { getLatestPeriod } from "@/lib/data/enrollment-picker";
import { enrollmentInScope } from "@/lib/data/request-scope-sql";
import {
  collatedText,
  orderByFor,
  plainColumn,
  type SortExpr,
} from "@/lib/data/sort-sql";
import { containsPattern } from "@/lib/data/sql-like";
import { clampPage } from "@/lib/data/users";
import type { ListSort } from "@/lib/list-params";
import type { RequestScope } from "@/lib/intake/request-scope";
import { VISIBLE_STATES } from "@/lib/intake/states";

export type ListInscripcionesParams = {
  /** From the SESSION only, via `requireEnrollmentAccess`. */
  scope: RequestScope;
  /** Already normalised by `parseInscripcionesListParams`; "" means unset. */
  q: string;
  asignatura: string;
  grupo: string;
  periodo: string;
  status: InscripcionStatusFilter;
  page: number;
  pageSize: number;
  sort?: ListSort<InscripcionesSortKey>;
};

/**
 * Whitelist of sortable columns (DT-SORT-1): the URL value is only a lookup
 * key, never interpolated. Names are collated; the group number is plain.
 */
const INSCRIPCIONES_SORT_MAP = {
  student: collatedText(usuario.nombreCompleto),
  subject: collatedText(asignatura.nombre),
  group: plainColumn(grupo.numeroGrupo),
} satisfies Record<InscripcionesSortKey, SortExpr>;

const sibling = alias(inscripcion, "sib");
const siblingGroup = alias(grupo, "sibg");

/** Another raw-active row of the same student, asignatura and period. */
const HAS_ACTIVE_SIBLING = sql<boolean>`exists (select 1 from ${inscripcion} ${sibling} inner join ${grupo} ${siblingGroup} on ${siblingGroup.id} = ${sibling.grupoId} where ${sibling.estudianteId} = ${inscripcion.estudianteId} and ${sibling.activo} and ${sibling.grupoId} <> ${inscripcion.grupoId} and ${siblingGroup.asignaturaId} = ${grupo.asignaturaId} and ${siblingGroup.periodo} = ${grupo.periodo})`;

/** CS-7: the student's requests naming the group, by `VISIBLE_STATES` (no draft). */
const DEPENDENT_REQUESTS =
  sql<number>`(select count(*) from ${solicitudAsignatura} inner join ${solicitud} on ${solicitud.id} = ${solicitudAsignatura.solicitudId} where ${solicitudAsignatura.grupoId} = ${inscripcion.grupoId} and ${solicitud.estudianteId} = ${inscripcion.estudianteId} and ${inArray(solicitud.estado, [...VISIBLE_STATES])})`.mapWith(
    Number,
  );

/** The chosen key, the default key, then the composite primary key, so the
 *  order is total and no row is skipped or repeated across pages. */
function inscripcionesOrderBy(sort: ListSort<InscripcionesSortKey>): SQL[] {
  const chosen = Object.hasOwn(INSCRIPCIONES_SORT_MAP, sort.key)
    ? sort
    : INSCRIPCIONES_DEFAULT_SORT;
  const directed = chosen.dir === "asc" ? asc : desc;
  return [
    ...orderByFor(
      INSCRIPCIONES_SORT_MAP,
      sort,
      INSCRIPCIONES_DEFAULT_SORT,
      inscripcion.estudianteId,
    ),
    directed(inscripcion.grupoId),
  ];
}

/** A period the secretaria asked for, when it exists; the latest otherwise. */
async function resolvePeriod(
  requested: string,
  latest: string,
): Promise<string> {
  if (requested === "" || requested === latest) return latest;
  const [found] = await db
    .select({ one: sql`1` })
    .from(grupo)
    .where(eq(grupo.periodo, requested))
    .limit(1);
  return found ? requested : latest;
}

/**
 * The one WHERE of the count and the page. The scope is the first term;
 * `status` filters the RAW state (EA-FILT-1), so an inactive row of an
 * inactive group still shows as inactive.
 */
function buildInscripcionesWhere(
  p: ListInscripcionesParams,
  periodo: string,
): SQL {
  const parts = [
    enrollmentInScope(p.scope),
    eq(grupo.periodo, periodo),
    p.status === "active"
      ? sql`${inscripcion.activo}`
      : not(inscripcion.activo),
    p.q
      ? or(
          ilike(usuario.nombreCompleto, containsPattern(p.q)),
          ilike(usuario.cif, containsPattern(p.q)),
        )
      : undefined,
    p.asignatura
      ? or(
          ilike(asignatura.codigo, containsPattern(p.asignatura)),
          ilike(asignatura.nombre, containsPattern(p.asignatura)),
        )
      : undefined,
    p.grupo ? eq(grupo.numeroGrupo, p.grupo) : undefined,
  ].filter((part): part is SQL => part !== undefined);
  return and(...parts) as SQL;
}

function emptyPage(
  pageSize: number,
  degraded: boolean,
): InscripcionesListResult {
  return {
    data: [],
    total: 0,
    page: 1,
    pageSize,
    degraded,
    resolvedPeriodo: "",
  };
}

/**
 * The staff inscripciones list (enrollment-administration CS-6). Only the
 * student name and CIF leave the data layer (EA-PII-1); the row is mapped key
 * by key so nothing else can ride along. Fail-soft like `listAsignaturas`: a
 * thrown error is an empty, degraded page (EA-DEG-1). `resolvedPeriodo` is the
 * period the rows were read for, so the audited page records the real period
 * even when none was chosen.
 */
export async function listInscripciones(
  p: ListInscripcionesParams,
): Promise<InscripcionesListResult> {
  if (p.scope.kind === "none") return emptyPage(p.pageSize, false);
  try {
    const latest = await getLatestPeriod();
    if (latest === null) return emptyPage(p.pageSize, false);
    const resolvedPeriodo = await resolvePeriod(p.periodo, latest);
    const where = buildInscripcionesWhere(p, resolvedPeriodo);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(inscripcion)
      .innerJoin(usuario, eq(usuario.id, inscripcion.estudianteId))
      .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
      .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
      .where(where);
    const page = clampPage(p.page, count, p.pageSize);
    const rows = await db
      .select({
        estudianteId: inscripcion.estudianteId,
        grupoId: inscripcion.grupoId,
        estudianteNombre: usuario.nombreCompleto,
        estudianteCif: usuario.cif,
        asignaturaId: asignatura.id,
        asignaturaCodigo: asignatura.codigo,
        asignaturaNombre: asignatura.nombre,
        periodo: grupo.periodo,
        numeroGrupo: grupo.numeroGrupo,
        activo: inscripcion.activo,
        grupoActivo: grupo.activo,
        asignaturaActivo: asignatura.activo,
        hasActiveSibling: HAS_ACTIVE_SIBLING,
        dependentRequests: DEPENDENT_REQUESTS,
      })
      .from(inscripcion)
      .innerJoin(usuario, eq(usuario.id, inscripcion.estudianteId))
      .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
      .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
      .where(where)
      .orderBy(...inscripcionesOrderBy(p.sort ?? INSCRIPCIONES_DEFAULT_SORT))
      .limit(p.pageSize)
      .offset((page - 1) * p.pageSize);
    return {
      data: rows.map((r) => {
        const offered = r.grupoActivo && r.asignaturaActivo;
        return {
          estudianteId: r.estudianteId,
          grupoId: r.grupoId,
          estudianteNombre: r.estudianteNombre,
          estudianteCif: r.estudianteCif,
          asignaturaId: r.asignaturaId,
          asignaturaCodigo: r.asignaturaCodigo,
          asignaturaNombre: r.asignaturaNombre,
          periodo: r.periodo,
          numeroGrupo: r.numeroGrupo,
          activo: r.activo,
          effective: r.activo && offered,
          writable: r.periodo === latest && offered,
          hasActiveSibling: r.hasActiveSibling,
          dependentRequests: r.dependentRequests,
        };
      }),
      total: count,
      page,
      pageSize: p.pageSize,
      degraded: false,
      resolvedPeriodo,
    };
  } catch {
    return emptyPage(p.pageSize, true);
  }
}

/** In-scope periods, newest first, for the period select; fail-soft (`[]`). */
export async function listInscripcionPeriods(
  scope: RequestScope,
): Promise<string[]> {
  if (scope.kind === "none") return [];
  try {
    const rows = await db
      .selectDistinct({ periodo: grupo.periodo })
      .from(inscripcion)
      .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
      .where(enrollmentInScope(scope))
      .orderBy(desc(grupo.periodo));
    return rows.map((r) => r.periodo);
  } catch {
    return [];
  }
}

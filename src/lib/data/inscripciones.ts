import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
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
  rol,
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
import {
  getLatestPeriod,
  listEnrollableAsignaturas,
  listEnrollableGroups,
  type EnrollableAsignatura,
  type EnrollableGroup,
} from "@/lib/data/enrollment-picker";
import {
  enrollmentInScope,
  studentRowInScope,
} from "@/lib/data/request-scope-sql";
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

/** Most students one search returns (EA-CRE-1); a term matching more asks the
 *  secretaria to narrow it, so a short term cannot dump a whole facultad. */
export const STUDENT_SEARCH_MAX = 20;

/** A student as the search and the assign page show them: the id that travels
 *  in the form, the full name and the CIF, nothing else (EA-PII-1). */
export type StudentSearchResult = {
  id: number;
  nombreCompleto: string;
  cif: string | null;
};

export type StudentSearchOutcome = {
  data: StudentSearchResult[];
  degraded: boolean;
};

/** The columns of `StudentSearchResult`; no email, phone or any other. */
const STUDENT_FIELDS = {
  id: usuario.id,
  nombreCompleto: usuario.nombreCompleto,
  cif: usuario.cif,
};

/** Mapped key by key so a column the read did not ask for cannot ride along. */
function toStudent(row: StudentSearchResult): StudentSearchResult {
  return { id: row.id, nombreCompleto: row.nombreCompleto, cif: row.cif };
}

/** An ACTIVE estudiante of the scope: not another role, not an inactive
 *  account, not a cancelled one (EA-CRE-1). Needs `rol` joined. */
function activeStudentInScope(scope: RequestScope): SQL {
  return and(
    studentRowInScope(scope),
    eq(rol.codigo, "estudiante"),
    eq(usuario.activo, true),
    isNull(usuario.canceladoEn),
  ) as SQL;
}

/**
 * The student search of the assign page: in-scope active estudiantes whose
 * name or CIF contains `q`, name and CIF only (EA-CRE-1, EA-PII-1). A scope of
 * `none` and a blank term read nothing. Fail-soft: a thrown error is an empty,
 * degraded result, which the page never audits (EA-DEG-1).
 */
export async function searchStudents(
  scope: RequestScope,
  q: string,
): Promise<StudentSearchOutcome> {
  const term = q.trim();
  if (scope.kind === "none" || term === "") {
    return { data: [], degraded: false };
  }
  try {
    const rows = await db
      .select(STUDENT_FIELDS)
      .from(usuario)
      .innerJoin(rol, eq(rol.id, usuario.rolId))
      .where(
        and(
          activeStudentInScope(scope),
          or(
            ilike(usuario.nombreCompleto, containsPattern(term)),
            ilike(usuario.cif, containsPattern(term)),
          ),
        ),
      )
      .orderBy(collatedText(usuario.nombreCompleto)("asc"), asc(usuario.id))
      .limit(STUDENT_SEARCH_MAX);
    return { data: rows.map(toStudent), degraded: false };
  } catch {
    return { data: [], degraded: true };
  }
}

/** A group of the picked asignatura, `current` when it is the student's
 *  active one there. */
export type AssignGroup = EnrollableGroup & { current: boolean };

/** What the assign page shows for one student (EA-CRE-1, EA-CHG-1). */
export type AssignPageData = {
  student: StudentSearchResult;
  /** Latest offered period; null when nothing is offered. */
  periodo: string | null;
  asignaturas: EnrollableAsignatura[];
  /** The asignatura list hit `CATALOG_OPTIONS_MAX`. */
  truncated: boolean;
  /** Offered groups of the picked asignatura; empty with no valid pick. */
  groups: AssignGroup[];
  /** The student's raw-active group of the picked asignatura and period, the
   *  one an activation would replace (EA-SIB-1), even when it is no longer
   *  offered; null when there is none. */
  currentGroup: { grupoId: number; numeroGrupo: string } | null;
};

/** `not_found` answers alike for an unknown student, one of another facultad,
 *  a cancelled account and a user of another role (EA-SCOPE-1, CS-2). */
export type AssignPageResult =
  | { kind: "not_found"; degraded: false }
  | { kind: "ok"; degraded: false; data: AssignPageData }
  | { kind: "degraded"; degraded: true };

/**
 * The reads of `/catalog/inscripciones/assign` for one student: the student
 * (inside the scope), the asignaturas and, for a picked asignatura, its offered
 * groups of the latest period with the student's current one marked. The pick
 * is checked by the group read itself: an invalid or ineligible id has no
 * groups, and then no current group is read. Fail-soft like the other reads.
 */
export async function loadAssignPage(
  scope: RequestScope,
  estudianteId: number,
  asignaturaId: number | null,
): Promise<AssignPageResult> {
  if (scope.kind === "none") return { kind: "not_found", degraded: false };
  try {
    const [row] = await db
      .select(STUDENT_FIELDS)
      .from(usuario)
      .innerJoin(rol, eq(rol.id, usuario.rolId))
      .where(and(eq(usuario.id, estudianteId), activeStudentInScope(scope)))
      .limit(1);
    if (!row) return { kind: "not_found", degraded: false };
    const student = toStudent(row);
    const periodo = await getLatestPeriod();
    const none = { asignaturas: [], truncated: false, groups: [] };
    if (periodo === null) {
      return {
        kind: "ok",
        degraded: false,
        data: { student, periodo, ...none, currentGroup: null },
      };
    }
    const { data: asignaturas, truncated } = await listEnrollableAsignaturas(
      estudianteId,
      periodo,
    );
    const offered =
      asignaturaId === null
        ? []
        : await listEnrollableGroups(asignaturaId, periodo);
    let currentGroup: AssignPageData["currentGroup"] = null;
    if (asignaturaId !== null && offered.length > 0) {
      const [active] = await db
        .select({ grupoId: grupo.id, numeroGrupo: grupo.numeroGrupo })
        .from(inscripcion)
        .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
        .where(
          and(
            eq(inscripcion.estudianteId, estudianteId),
            eq(inscripcion.activo, true),
            eq(grupo.asignaturaId, asignaturaId),
            eq(grupo.periodo, periodo),
          ),
        )
        .orderBy(asc(grupo.id))
        .limit(1);
      currentGroup = active ?? null;
    }
    return {
      kind: "ok",
      degraded: false,
      data: {
        student,
        periodo,
        asignaturas,
        truncated,
        groups: offered.map((g) => ({
          ...g,
          current: g.grupoId === currentGroup?.grupoId,
        })),
        currentGroup,
      },
    };
  } catch {
    return { kind: "degraded", degraded: true };
  }
}

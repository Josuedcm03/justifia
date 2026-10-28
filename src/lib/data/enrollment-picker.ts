import "server-only";

import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  asignatura,
  carrera,
  grupo,
  inscripcion,
  solicitud,
  solicitudAsignatura,
  usuario,
} from "@/db/schema";
import { decodeDias, type DiaSemana } from "@/lib/catalog/dias";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";

// Student-scoped reads of the /enrollment page (student-enrollment SE-4, SE-5,
// SE-7). Nothing here selects a docente email or phone: only the name leaves
// the data layer (RNF-01, RNF-02).

export type MyEnrollment = {
  grupoId: number;
  asignaturaId: number;
  asignaturaCodigo: string;
  asignaturaNombre: string;
  periodo: string;
  numeroGrupo: string;
  /** Null when the group has no teacher: the UI shows a label. */
  docenteNombre: string | null;
  /** A draft or returned request of this student names the group (SE-7). */
  inOpenRequest: boolean;
};

export type EnrollableAsignatura = {
  id: number;
  codigo: string;
  nombre: string;
  carreraNombre: string;
  /** The asignatura belongs to the student's carrera; false for all when the
   *  student has none. */
  ownCarrera: boolean;
};

export type EnrollableGroup = {
  grupoId: number;
  numeroGrupo: string;
  docenteNombre: string | null;
  dias: DiaSemana[];
};

export type EnrollmentPageData = {
  /** Latest period; null when nothing is offered. */
  periodo: string | null;
  enrollments: MyEnrollment[];
  asignaturas: EnrollableAsignatura[];
  /** The asignatura list hit `CATALOG_OPTIONS_MAX`. */
  truncated: boolean;
  /** Groups of the selected asignatura; empty when none is selected. */
  groups: EnrollableGroup[];
};

/** Greatest `Periodo` among active grupos of ACTIVE asignaturas; the
 *  `PERIODO_RE` format makes the maximum chronological. */
export async function getLatestPeriod(): Promise<string | null> {
  const [row] = await db
    .select({ periodo: max(grupo.periodo) })
    .from(grupo)
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .where(and(eq(grupo.activo, true), eq(asignatura.activo, true)));
  return row?.periodo ?? null;
}

/** Effective enrollments of ALL periods (active inscripcion, grupo and
 *  asignatura). One query carries the dependent-request flag. */
export function listMyEnrollments(estudianteId: number) {
  return db
    .select({
      grupoId: grupo.id,
      asignaturaId: asignatura.id,
      asignaturaCodigo: asignatura.codigo,
      asignaturaNombre: asignatura.nombre,
      periodo: grupo.periodo,
      numeroGrupo: grupo.numeroGrupo,
      docenteNombre: usuario.nombreCompleto,
      inOpenRequest: sql<boolean>`exists (select 1 from ${solicitudAsignatura} inner join ${solicitud} on ${solicitud.id} = ${solicitudAsignatura.solicitudId} where ${solicitudAsignatura.grupoId} = ${inscripcion.grupoId} and ${solicitud.estudianteId} = ${estudianteId} and ${solicitud.estado} in ('borrador', 'devuelta'))`,
    })
    .from(inscripcion)
    .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .leftJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(
      and(
        eq(inscripcion.estudianteId, estudianteId),
        eq(inscripcion.activo, true),
        eq(grupo.activo, true),
        eq(asignatura.activo, true),
      ),
    )
    .orderBy(asc(asignatura.nombre), asc(grupo.numeroGrupo)) as Promise<
    MyEnrollment[]
  >;
}

/** Active asignaturas with an active grupo in `periodo`, the student's own
 *  carrera first. Capped; `truncated` says the cap was reached. */
export async function listEnrollableAsignaturas(
  estudianteId: number,
  periodo: string,
): Promise<{ data: EnrollableAsignatura[]; truncated: boolean }> {
  const ownCarrera = sql<boolean>`coalesce(${asignatura.carreraId} = ${usuario.carreraId}, false)`;
  const rows: EnrollableAsignatura[] = await db
    .select({
      id: asignatura.id,
      codigo: asignatura.codigo,
      nombre: asignatura.nombre,
      carreraNombre: carrera.nombre,
      ownCarrera,
    })
    .from(asignatura)
    .innerJoin(carrera, eq(carrera.id, asignatura.carreraId))
    .innerJoin(usuario, sql`true`)
    .where(
      and(
        eq(usuario.id, estudianteId),
        eq(asignatura.activo, true),
        sql`exists (select 1 from ${grupo} where ${grupo.asignaturaId} = ${asignatura.id} and ${grupo.periodo} = ${periodo} and ${grupo.activo})`,
      ),
    )
    .orderBy(desc(ownCarrera), asc(asignatura.nombre))
    .limit(CATALOG_OPTIONS_MAX + 1);
  return {
    data: rows.slice(0, CATALOG_OPTIONS_MAX),
    truncated: rows.length > CATALOG_OPTIONS_MAX,
  };
}

/** Active grupos of an active asignatura in `periodo`. Empty for an unknown or
 *  ineligible id. */
export async function listEnrollableGroups(
  asignaturaId: number,
  periodo: string,
): Promise<EnrollableGroup[]> {
  const rows = await db
    .select({
      grupoId: grupo.id,
      numeroGrupo: grupo.numeroGrupo,
      docenteNombre: usuario.nombreCompleto,
      dias: grupo.dias,
    })
    .from(grupo)
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .leftJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(
      and(
        eq(grupo.asignaturaId, asignaturaId),
        eq(grupo.periodo, periodo),
        eq(grupo.activo, true),
        eq(asignatura.activo, true),
      ),
    )
    .orderBy(asc(grupo.numeroGrupo));
  return rows.map((row) => ({ ...row, dias: decodeDias(row.dias) }));
}

const EMPTY_PAGE: EnrollmentPageData = {
  periodo: null,
  enrollments: [],
  asignaturas: [],
  truncated: false,
  groups: [],
};

/** UI read: never throws, reports `degraded` instead (project convention). */
export async function loadEnrollmentPage(
  estudianteId: number,
  asignaturaId: number | null,
): Promise<{ data: EnrollmentPageData; degraded: boolean }> {
  try {
    const periodo = await getLatestPeriod();
    const enrollments = await listMyEnrollments(estudianteId);
    if (periodo === null) {
      return { data: { ...EMPTY_PAGE, enrollments }, degraded: false };
    }
    const { data: asignaturas, truncated } = await listEnrollableAsignaturas(
      estudianteId,
      periodo,
    );
    const groups =
      asignaturaId === null
        ? []
        : await listEnrollableGroups(asignaturaId, periodo);
    return {
      data: { periodo, enrollments, asignaturas, truncated, groups },
      degraded: false,
    };
  } catch {
    return { data: EMPTY_PAGE, degraded: true };
  }
}

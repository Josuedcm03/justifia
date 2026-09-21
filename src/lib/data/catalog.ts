import "server-only";

import { and, eq } from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  QueryBuilder,
} from "drizzle-orm/pg-core";

import {
  asignatura,
  carrera,
  facultad,
  grupo,
  inscripcion,
  rol,
  usuario,
} from "@/db/schema";
import type { CatalogSnapshot } from "@/lib/import/types";

/**
 * Anything that can run a `select`: the `db` singleton or a transaction handle
 * (`exec` in the design). The import reads the snapshot twice, once for the
 * preview and once inside the apply transaction, through the same function.
 */
export type CatalogExecutor = PgDatabase<
  PgQueryResultHKT,
  Record<string, unknown>
>;

/**
 * Full read of the catalog for the planner. Deliberately unfiltered: inactive
 * `Grupo`/`Inscripcion` rows MUST be visible so the planner can reactivate or
 * leave them alone (catalog-excel-import: deactivate absent, never delete).
 * `hashClave` is never selected.
 */
export async function loadCatalogSnapshot(
  exec: CatalogExecutor,
): Promise<CatalogSnapshot> {
  const [facultades, carreras, asignaturas, usuarios, grupos, inscripciones] =
    await Promise.all([
      exec.select({ id: facultad.id, nombre: facultad.nombre }).from(facultad),
      exec
        .select({
          id: carrera.id,
          nombre: carrera.nombre,
          facultadId: carrera.facultadId,
        })
        .from(carrera),
      exec
        .select({
          id: asignatura.id,
          codigo: asignatura.codigo,
          nombre: asignatura.nombre,
          carreraId: asignatura.carreraId,
          horasTotales: asignatura.horasTotales,
        })
        .from(asignatura),
      exec
        .select({
          id: usuario.id,
          login: usuario.login,
          correo: usuario.correo,
          cif: usuario.cif,
          nombreCompleto: usuario.nombreCompleto,
          carreraId: usuario.carreraId,
          activo: usuario.activo,
          rol: rol.codigo,
        })
        .from(usuario)
        .innerJoin(rol, eq(usuario.rolId, rol.id)),
      exec
        .select({
          id: grupo.id,
          asignaturaId: grupo.asignaturaId,
          periodo: grupo.periodo,
          numeroGrupo: grupo.numeroGrupo,
          docenteId: grupo.docenteId,
          activo: grupo.activo,
        })
        .from(grupo),
      exec
        .select({
          estudianteId: inscripcion.estudianteId,
          grupoId: inscripcion.grupoId,
          activo: inscripcion.activo,
        })
        .from(inscripcion),
    ]);
  return { facultades, carreras, asignaturas, usuarios, grupos, inscripciones };
}

export type ActiveGruposParams = {
  /** CIF of the student (only students carry a CIF). */
  cif: string;
  codigoAsignatura: string;
  periodo: string;
};

/**
 * Pure query shape (RF-03): the groups in which the student is CURRENTLY
 * enrolled for an asignatura and period. `Activo` is required on both
 * `Inscripcion` and `Grupo`; there is no `limit` because more than one active
 * group must reach the caller (RF-02, X8).
 */
export function buildActiveGruposForEstudianteQuery(
  qb: QueryBuilder,
  p: ActiveGruposParams,
) {
  return qb
    .select({
      grupoId: grupo.id,
      periodo: grupo.periodo,
      numeroGrupo: grupo.numeroGrupo,
      docenteId: grupo.docenteId,
    })
    .from(inscripcion)
    .innerJoin(usuario, eq(inscripcion.estudianteId, usuario.id))
    .innerJoin(grupo, eq(inscripcion.grupoId, grupo.id))
    .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
    .where(
      and(
        eq(usuario.cif, p.cif),
        eq(asignatura.codigo, p.codigoAsignatura),
        eq(grupo.periodo, p.periodo),
        eq(inscripcion.activo, true),
        eq(grupo.activo, true),
      ),
    );
}

/**
 * Pure query shape (RF-31): is the student enrolled in this group right now?
 * Both the enrollment and its group must be active.
 */
export function buildActiveEnrollmentQuery(
  qb: QueryBuilder,
  p: { cif: string; grupoId: number },
) {
  return qb
    .select({ grupoId: inscripcion.grupoId })
    .from(inscripcion)
    .innerJoin(usuario, eq(inscripcion.estudianteId, usuario.id))
    .innerJoin(grupo, eq(inscripcion.grupoId, grupo.id))
    .where(
      and(
        eq(usuario.cif, p.cif),
        eq(inscripcion.grupoId, p.grupoId),
        eq(inscripcion.activo, true),
        eq(grupo.activo, true),
      ),
    );
}

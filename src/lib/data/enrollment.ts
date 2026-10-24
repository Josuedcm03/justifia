import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { asignatura, grupo, inscripcion, usuario } from "@/db/schema";
import type { GroupScheduleProvider } from "@/lib/intake/ports";

// Enrollment queries for the intake flow (RF-04, RN-21, RN-22, D5, D15). The
// subject list is the student's own enrollment: Inscripcion -> Grupo ->
// Asignatura, active rows only (RF-12 b), then narrowed by the schedule port.

export type EnrollmentGroup = {
  grupoId: number;
  asignaturaId: number;
  asignaturaCodigo: string;
  asignaturaNombre: string;
  periodo: string;
  numeroGrupo: string;
  /** Null when the group has no teacher: the UI shows a label (D15). */
  docenteNombre: string | null;
};

export type DateRange = { from: string; to: string };

const ACTIVE_ENROLLMENT = (estudianteId: number) =>
  and(
    eq(inscripcion.estudianteId, estudianteId),
    eq(inscripcion.activo, true),
    eq(grupo.activo, true),
    eq(asignatura.activo, true),
  );

/**
 * The student's effective enrollment (active inscripcion, grupo and asignatura)
 * with no schedule filter. Fails loud.
 */
export async function listEnrolledGroups(
  estudianteId: number,
): Promise<EnrollmentGroup[]> {
  return db
    .select({
      grupoId: grupo.id,
      asignaturaId: asignatura.id,
      asignaturaCodigo: asignatura.codigo,
      asignaturaNombre: asignatura.nombre,
      periodo: grupo.periodo,
      numeroGrupo: grupo.numeroGrupo,
      docenteNombre: usuario.nombreCompleto,
    })
    .from(inscripcion)
    .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .leftJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(ACTIVE_ENROLLMENT(estudianteId))
    .orderBy(asc(asignatura.nombre), asc(grupo.numeroGrupo));
}

/**
 * Keeps the groups with class in `range` through the schedule port (RN-22);
 * with `null` (dates not set yet) enrollment alone applies.
 */
export async function withClassIn(
  groups: EnrollmentGroup[],
  range: DateRange | null,
  schedule: GroupScheduleProvider,
): Promise<EnrollmentGroup[]> {
  if (range === null || groups.length === 0) return groups;
  const withClass = await schedule.groupsWithClass(
    groups.map((g) => g.grupoId),
    range,
  );
  return groups.filter((g) => withClass.has(g.grupoId));
}

/**
 * Active groups the student may name on a request. Fails loud: the submit
 * re-check relies on it.
 */
export async function listEligibleGroups(
  estudianteId: number,
  range: DateRange | null,
  schedule: GroupScheduleProvider,
): Promise<EnrollmentGroup[]> {
  return withClassIn(await listEnrolledGroups(estudianteId), range, schedule);
}

/**
 * UI read: never throws, reports `degraded` instead (project convention).
 * `enrolled` is judged on the unfiltered list, so step 2 can tell "no
 * enrollment" from "no class in these dates"; a failed read reports it true so
 * the wrong "no enrollment" message never shows.
 */
export async function listEnrollmentFailSoft(
  estudianteId: number,
  range: DateRange | null,
  schedule: GroupScheduleProvider,
): Promise<{ data: EnrollmentGroup[]; degraded: boolean; enrolled: boolean }> {
  try {
    const all = await listEnrolledGroups(estudianteId);
    return {
      data: await withClassIn(all, range, schedule),
      degraded: false,
      enrolled: all.length > 0,
    };
  } catch {
    return { data: [], degraded: true, enrolled: true };
  }
}

/** Whether the student has any effective enrollment; `null` on a failed read. */
export async function hasActiveEnrollmentFailSoft(
  estudianteId: number,
): Promise<boolean | null> {
  try {
    const rows = await db
      .select({ grupoId: grupo.id })
      .from(inscripcion)
      .innerJoin(grupo, eq(grupo.id, inscripcion.grupoId))
      .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
      .where(ACTIVE_ENROLLMENT(estudianteId))
      .limit(1);
    return rows.length > 0;
  } catch {
    return null;
  }
}

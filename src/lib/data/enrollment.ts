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

/**
 * Active groups the student may name on a request. With a valid `range` the
 * schedule port keeps only groups with class in it (RN-22); with `null` (dates
 * not set yet) enrollment alone applies. Fails loud: the submit re-check relies
 * on it.
 */
export async function listEligibleGroups(
  estudianteId: number,
  range: DateRange | null,
  schedule: GroupScheduleProvider,
): Promise<EnrollmentGroup[]> {
  const groups: EnrollmentGroup[] = await db
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
    .where(
      and(
        eq(inscripcion.estudianteId, estudianteId),
        eq(inscripcion.activo, true),
        eq(grupo.activo, true),
        eq(asignatura.activo, true),
      ),
    )
    .orderBy(asc(asignatura.nombre), asc(grupo.numeroGrupo));

  if (range === null || groups.length === 0) return groups;
  const withClass = await schedule.groupsWithClass(
    groups.map((g) => g.grupoId),
    range,
  );
  return groups.filter((g) => withClass.has(g.grupoId));
}

/** UI read: never throws, reports `degraded` instead (project convention). */
export async function listEnrollmentFailSoft(
  estudianteId: number,
  range: DateRange | null,
  schedule: GroupScheduleProvider,
): Promise<{ data: EnrollmentGroup[]; degraded: boolean }> {
  try {
    return {
      data: await listEligibleGroups(estudianteId, range, schedule),
      degraded: false,
    };
  } catch {
    return { data: [], degraded: true };
  }
}

import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import type { db } from "@/db";
import { asignatura, grupo, solicitudAsignatura, usuario } from "@/db/schema";
import type { Transaction } from "@/lib/data/audit";
import type { RequestTeacher } from "@/lib/remission/recipients";

/**
 * One class of a request as the review screens and the revision snapshot show
 * it. No period is returned and `docenteNombre` may be null, so a later change
 * to the class tables does not reach the callers (secretary-review, SR-3).
 */
export type RequestClass = {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  numeroGrupo: string;
  docenteNombre: string | null;
};

type Db = typeof db;

/**
 * The classes of each request, keyed by request id (requests without class
 * rows are absent). This is the ONLY module that joins
 * `SolicitudAsignatura -> Grupo -> Asignatura -> Usuario`: every reader in the
 * review change (queue, staff detail, student detail, revision snapshot) calls
 * it instead of joining inline. Classes are ordered by subject code, then
 * group, so the order is stable across reads.
 */
export async function listRequestClasses(
  q: Db | Transaction,
  solicitudIds: readonly number[],
): Promise<Map<number, RequestClass[]>> {
  const byRequest = new Map<number, RequestClass[]>();
  if (solicitudIds.length === 0) return byRequest;

  const rows = await q
    .select({
      solicitudId: solicitudAsignatura.solicitudId,
      asignaturaId: asignatura.id,
      codigo: asignatura.codigo,
      nombre: asignatura.nombre,
      numeroGrupo: grupo.numeroGrupo,
      docenteNombre: usuario.nombreCompleto,
    })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .leftJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(inArray(solicitudAsignatura.solicitudId, [...solicitudIds]))
    .orderBy(
      asc(solicitudAsignatura.solicitudId),
      asc(asignatura.codigo),
      asc(grupo.numeroGrupo),
    );

  for (const r of rows) {
    const list = byRequest.get(r.solicitudId) ?? [];
    list.push({
      asignaturaId: r.asignaturaId,
      codigo: r.codigo,
      nombre: r.nombre,
      numeroGrupo: r.numeroGrupo,
      docenteNombre: r.docenteNombre,
    });
    byRequest.set(r.solicitudId, list);
  }
  return byRequest;
}

/**
 * The teachers of one request with their own groups (teacher-remission, TR-4),
 * read on the approval transaction so the snapshot is the state at approval.
 * Same joins and order as `listRequestClasses`; a group whose teacher cannot
 * be identified comes back with a null `docenteId` (it yields no remission).
 * Teachers keep the order of their first group.
 */
export async function listRequestTeachers(
  q: Db | Transaction,
  solicitudId: number,
): Promise<RequestTeacher[]> {
  const rows = await q
    .select({
      docenteId: grupo.docenteId,
      docenteNombre: usuario.nombreCompleto,
      docenteCorreo: usuario.correo,
      asignaturaId: asignatura.id,
      codigo: asignatura.codigo,
      nombre: asignatura.nombre,
      numeroGrupo: grupo.numeroGrupo,
    })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
    .leftJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(eq(solicitudAsignatura.solicitudId, solicitudId))
    .orderBy(asc(asignatura.codigo), asc(grupo.numeroGrupo));

  const teachers = new Map<number | null, RequestTeacher>();
  for (const r of rows) {
    const teacher = teachers.get(r.docenteId) ?? {
      docenteId: r.docenteId,
      nombre: r.docenteNombre,
      correo: r.docenteCorreo,
      clases: [],
    };
    teacher.clases.push({
      asignaturaId: r.asignaturaId,
      codigo: r.codigo,
      nombre: r.nombre,
      numeroGrupo: r.numeroGrupo,
    });
    teachers.set(r.docenteId, teacher);
  }
  return [...teachers.values()];
}

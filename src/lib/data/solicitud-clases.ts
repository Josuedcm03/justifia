import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import type { db } from "@/db";
import { asignatura, grupo, solicitudAsignatura, usuario } from "@/db/schema";
import type { Transaction } from "@/lib/data/audit";

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

import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { asignatura, grupo, inscripcion, rol, usuario } from "@/db/schema";
import { enrollmentWriteEvents } from "@/lib/audit/events";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import { sqlStateOf } from "@/lib/data/catalog-write";
import type { DropResult, EnrollResult } from "@/lib/enrollment/types";

export type { DropResult, EnrollResult };

// The ONLY module that writes `Inscripcion` (student-enrollment SE-1..SE-3,
// SE-12). One short transaction per action: lock the student's own `Usuario`
// row (which is also the role check), run guarded statements, append the audit
// rows on the same handle. Rows are deactivated, never removed (D7).

const NOT_STUDENT = { ok: false, reason: "not_student" } as const;

/** SE-4: the latest period, evaluated at write time, over active grupos of
 *  ACTIVE asignaturas. An inactive row never sets it. */
const latestPeriod = sql`(select max(${grupo.periodo}) from ${grupo} inner join ${asignatura} on ${asignatura.id} = ${grupo.asignaturaId} where ${grupo.activo} and ${asignatura.activo})`;

/** One sanitised line for an unexpected write failure: actor, error name and
 *  SQLSTATE only, shaped like `logCatalogFailure`. */
function logEnrollmentFailure(actor: number, error: unknown): void {
  const errorCode = sqlStateOf(error);
  console.error(
    JSON.stringify({
      event: "enrollment.write.failed",
      actor,
      errorName: error instanceof Error ? error.name : typeof error,
      ...(errorCode === undefined ? {} : { errorCode }),
    }),
  );
}

/** Locks only the student's `Usuario` row (`of`, so `Rol` is not locked) and
 *  proves it is an active estudiante: stale sessions of other roles stop here
 *  (SE-1, SE-3). */
async function lockStudent(tx: Transaction, estudianteId: number) {
  const rows = await tx
    .select({ id: usuario.id })
    .from(usuario)
    .innerJoin(rol, eq(rol.id, usuario.rolId))
    .where(
      and(
        eq(usuario.id, estudianteId),
        eq(rol.codigo, "estudiante"),
        eq(usuario.activo, true),
      ),
    )
    .for("no key update", { of: usuario });
  return rows.length > 0;
}

/** Lock, `work`, then the audit rows last on the same handle: a failure on
 *  either side rolls back both. The actor is the student id argument, never a
 *  payload value. */
async function writeAsStudent<R extends EnrollResult | DropResult>(
  estudianteId: number,
  work: (tx: Transaction) => Promise<R>,
): Promise<R> {
  try {
    return await db.transaction(async (tx) => {
      if (!(await lockStudent(tx, estudianteId))) return NOT_STUDENT as R;
      const result = await work(tx);
      const events = enrollmentWriteEvents(estudianteId, result);
      if (events.length > 0) await insertAuditEvents(tx, estudianteId, events);
      return result;
    });
  } catch (error) {
    logEnrollmentFailure(estudianteId, error);
    throw error;
  }
}

export function enrollInGroup(
  estudianteId: number,
  grupoId: number,
): Promise<EnrollResult> {
  return writeAsStudent<EnrollResult>(estudianteId, async (tx) => {
    const [target] = await tx
      .select({
        id: grupo.id,
        asignaturaId: grupo.asignaturaId,
        periodo: grupo.periodo,
      })
      .from(grupo)
      .innerJoin(asignatura, eq(asignatura.id, grupo.asignaturaId))
      .where(
        and(
          eq(grupo.id, grupoId),
          eq(grupo.activo, true),
          eq(asignatura.activo, true),
          eq(grupo.periodo, latestPeriod),
        ),
      );
    if (!target) return { ok: false, reason: "not_eligible" };

    const pair = and(
      eq(inscripcion.estudianteId, estudianteId),
      eq(inscripcion.grupoId, grupoId),
    );
    const [existing] = await tx
      .select({ activo: inscripcion.activo })
      .from(inscripcion)
      .where(pair);
    if (existing?.activo) return { ok: false, reason: "already_enrolled" };

    const siblings = await tx
      .update(inscripcion)
      .set({ activo: false })
      .where(
        and(
          eq(inscripcion.estudianteId, estudianteId),
          eq(inscripcion.activo, true),
          ne(inscripcion.grupoId, grupoId),
          sql`${inscripcion.grupoId} in (select ${grupo.id} from ${grupo} where ${grupo.asignaturaId} = ${target.asignaturaId} and ${grupo.periodo} = ${target.periodo})`,
        ),
      )
      .returning({ grupoId: inscripcion.grupoId });

    if (existing) {
      await tx.update(inscripcion).set({ activo: true }).where(pair);
    } else {
      await tx
        .insert(inscripcion)
        .values({ estudianteId, grupoId, activo: true });
    }
    return {
      ok: true,
      kind: existing ? "reactivated" : "created",
      grupoId,
      replaced: siblings.map((row) => row.grupoId),
    };
  });
}

export function dropGroup(
  estudianteId: number,
  grupoId: number,
): Promise<DropResult> {
  return writeAsStudent<DropResult>(estudianteId, async (tx) => {
    const dropped = await tx
      .update(inscripcion)
      .set({ activo: false })
      .where(
        and(
          eq(inscripcion.estudianteId, estudianteId),
          eq(inscripcion.grupoId, grupoId),
          eq(inscripcion.activo, true),
        ),
      )
      .returning({ grupoId: inscripcion.grupoId });
    return dropped.length > 0
      ? { ok: true, grupoId }
      : { ok: false, reason: "not_enrolled" };
  });
}

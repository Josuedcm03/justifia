import "server-only";

import { and, eq, exists, ne, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  asignatura,
  carrera,
  grupo,
  inscripcion,
  rol,
  usuario,
} from "@/db/schema";
import { enrollmentWriteEvents } from "@/lib/audit/events";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import { sqlStateOf } from "@/lib/data/catalog-write";
import type { DropResult, EnrollResult } from "@/lib/enrollment/types";
import type { RequestScope } from "@/lib/intake/request-scope";

export type { DropResult, EnrollResult };

// The ONLY module that writes `Inscripcion` (student-enrollment SE-1..SE-3,
// SE-12; enrollment-administration EA-WRITE-1). One short transaction per
// action: lock the target student's `Usuario` row (which is also the role
// check), run guarded statements, append the audit rows on the same handle.
// The student and the secretaria writers share this path and differ only in
// the lock and in whose id is the audit actor. Rows are deactivated, never
// removed (D7).

const NOT_STUDENT = { ok: false, reason: "not_student" } as const;

/** The secretaria behind a staff write: her id and the scope the guard
 *  resolved from the database for this request (`requireEnrollmentAccess`). */
export type EnrollmentStaff = { actorId: number; scope: RequestScope };

type EnrollmentActor =
  | { kind: "student"; estudianteId: number }
  | {
      kind: "staff";
      actorId: number;
      estudianteId: number;
      scope: RequestScope;
    };

const qb = new QueryBuilder();
const actorUser = alias(usuario, "actor");
const actorRol = alias(rol, "actor_rol");

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

/** The writing user is, right now, an active secretaria of the facultad the
 *  request was scoped to (EA-WRITE-1): a stale session or a reassigned
 *  secretaria stops here, in the same statement as the lock. */
function activeSecretariaOf(actorId: number, facultadId: number) {
  return exists(
    qb
      .select({ one: sql`1` })
      .from(actorUser)
      .innerJoin(actorRol, eq(actorRol.id, actorUser.rolId))
      .where(
        and(
          eq(actorUser.id, actorId),
          eq(actorRol.codigo, "secretaria"),
          eq(actorUser.activo, true),
          eq(actorUser.facultadId, facultadId),
        ),
      ),
  );
}

/** The staff lock: still ONE statement and the same row lock as the student's
 *  (`of: usuario`), but the student must also belong to the secretaria's
 *  facultad through the CURRENT carrera (inner join: no carrera, no row) and
 *  the actor is verified. A foreign, missing or cancelled student answers
 *  alike (EA-SCOPE-1, CS-2); a scope of `none` renders `false`. */
async function lockStudentForStaff(
  tx: Transaction,
  actor: Extract<EnrollmentActor, { kind: "staff" }>,
) {
  const inScope =
    actor.scope.kind === "facultad"
      ? and(
          eq(carrera.facultadId, actor.scope.facultadId),
          activeSecretariaOf(actor.actorId, actor.scope.facultadId),
        )
      : sql`false`;
  const rows = await tx
    .select({ id: usuario.id })
    .from(usuario)
    .innerJoin(rol, eq(rol.id, usuario.rolId))
    .innerJoin(carrera, eq(carrera.id, usuario.carreraId))
    .where(
      and(
        eq(usuario.id, actor.estudianteId),
        eq(rol.codigo, "estudiante"),
        eq(usuario.activo, true),
        inScope,
      ),
    )
    .for("no key update", { of: usuario });
  return rows.length > 0;
}

/** Lock, `work`, then the audit rows last on the same handle: a failure on
 *  either side rolls back both. The audit actor is the student id argument or
 *  the staff session user, never a payload value; the audited entity is always
 *  the student. */
async function writeEnrollment<R extends EnrollResult | DropResult>(
  actor: EnrollmentActor,
  work: (tx: Transaction) => Promise<R>,
): Promise<R> {
  const auditActor =
    actor.kind === "student" ? actor.estudianteId : actor.actorId;
  try {
    return await db.transaction(async (tx) => {
      const locked =
        actor.kind === "student"
          ? await lockStudent(tx, actor.estudianteId)
          : await lockStudentForStaff(tx, actor);
      if (!locked) return NOT_STUDENT as R;
      const result = await work(tx);
      const events = enrollmentWriteEvents(actor.estudianteId, result);
      if (events.length > 0) await insertAuditEvents(tx, auditActor, events);
      return result;
    });
  } catch (error) {
    logEnrollmentFailure(auditActor, error);
    throw error;
  }
}

/** The sibling term of the spec: the student's OTHER raw-active rows of the
 *  same asignatura and period, whatever the state of their grupo. The student
 *  replace updates these rows and the staff reactivate refuses when any exists
 *  (EA-REACT-1 until EA-SIB-1), both through this one predicate. */
function siblingsOf(
  estudianteId: number,
  grupoId: number,
  target: { asignaturaId: number; periodo: string },
) {
  return and(
    eq(inscripcion.estudianteId, estudianteId),
    eq(inscripcion.activo, true),
    ne(inscripcion.grupoId, grupoId),
    sql`${inscripcion.grupoId} in (select ${grupo.id} from ${grupo} where ${grupo.asignaturaId} = ${target.asignaturaId} and ${grupo.periodo} = ${target.periodo})`,
  );
}

/** `reactivateOnly` is the staff mode of S2 (CS-3, CS-8): an existing inactive
 *  row is required (nothing is created), and a sibling refuses instead of being
 *  replaced, so no statement of that mode changes any row but the target. The
 *  student path never sets it and issues the same statements as before. */
function enrollWork(
  estudianteId: number,
  grupoId: number,
  { reactivateOnly }: { reactivateOnly: boolean } = { reactivateOnly: false },
) {
  return async (tx: Transaction): Promise<EnrollResult> => {
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
    if (reactivateOnly && !existing)
      return { ok: false, reason: "not_eligible" };

    const siblingRows = siblingsOf(estudianteId, grupoId, target);
    let replaced: number[] = [];
    if (reactivateOnly) {
      const [sibling] = await tx
        .select({ grupoId: inscripcion.grupoId })
        .from(inscripcion)
        .where(siblingRows);
      if (sibling) return { ok: false, reason: "not_eligible" };
    } else {
      const siblings = await tx
        .update(inscripcion)
        .set({ activo: false })
        .where(siblingRows)
        .returning({ grupoId: inscripcion.grupoId });
      replaced = siblings.map((row) => row.grupoId);
    }

    if (existing) {
      await tx
        .update(inscripcion)
        .set({ activo: true })
        .where(and(pair, eq(inscripcion.activo, false)));
    } else {
      await tx
        .insert(inscripcion)
        .values({ estudianteId, grupoId, activo: true });
    }
    return {
      ok: true,
      kind: existing ? "reactivated" : "created",
      grupoId,
      replaced,
    };
  };
}

/** Deactivates the student's own active row of any period: no period, grupo or
 *  asignatura filter, so a stale row of an older period can be dropped (D9,
 *  CS-3). The staff path reuses it unchanged. */
function dropWork(estudianteId: number, grupoId: number) {
  return async (tx: Transaction): Promise<DropResult> => {
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
  };
}

export function enrollInGroup(
  estudianteId: number,
  grupoId: number,
): Promise<EnrollResult> {
  return writeEnrollment<EnrollResult>(
    { kind: "student", estudianteId },
    enrollWork(estudianteId, grupoId),
  );
}

export function dropGroup(
  estudianteId: number,
  grupoId: number,
): Promise<DropResult> {
  return writeEnrollment<DropResult>(
    { kind: "student", estudianteId },
    dropWork(estudianteId, grupoId),
  );
}

/** A secretaria reactivates a student's inactive inscripcion of an offered
 *  group (EA-REACT-1, CS-3, CS-8). S2 is reactivate only: no row is created and
 *  an active sibling is refused (`not_eligible`) under the student's row lock,
 *  never replaced; S3 lifts both limits with the confirmation of EA-SIB-1. The
 *  audit actor is `staff.actorId`; refusals reuse the existing reasons (CS-2). */
export function staffEnrollInGroup(
  staff: EnrollmentStaff,
  estudianteId: number,
  grupoId: number,
): Promise<EnrollResult> {
  return writeEnrollment<EnrollResult>(
    {
      kind: "staff",
      actorId: staff.actorId,
      scope: staff.scope,
      estudianteId,
    },
    enrollWork(estudianteId, grupoId, { reactivateOnly: true }),
  );
}

/** A secretaria deactivates a student's inscripcion of any period (EA-DEACT-1,
 *  D9). `not_student` covers an out-of-scope, missing or non-student target and
 *  a stale actor alike (CS-2). The audit actor is `staff.actorId`. */
export function staffDropGroup(
  staff: EnrollmentStaff,
  estudianteId: number,
  grupoId: number,
): Promise<DropResult> {
  return writeEnrollment<DropResult>(
    {
      kind: "staff",
      actorId: staff.actorId,
      scope: staff.scope,
      estudianteId,
    },
    dropWork(estudianteId, grupoId),
  );
}

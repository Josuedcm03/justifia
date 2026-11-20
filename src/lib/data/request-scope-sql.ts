import "server-only";

import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import { alias, QueryBuilder, type PgColumn } from "drizzle-orm/pg-core";

import { carrera, inscripcion, solicitud, usuario } from "@/db/schema";
import type { RequestScope } from "@/lib/intake/request-scope";

const qb = new QueryBuilder();
const student = alias(usuario, "e");
const studentCareer = alias(carrera, "c");

function unhandled(scope: never): never {
  throw new Error(`Unhandled request scope: ${JSON.stringify(scope)}`);
}

/**
 * The student behind `column` belongs to the facultad of their CURRENT career
 * (`Usuario.CarreraId -> Carrera.FacultadId`). The inner join makes a student
 * without a career invisible; the snapshot career name is never used.
 */
function studentOfFacultad(column: PgColumn, facultadId: number): SQL {
  return exists(
    qb
      .select({ one: sql`1` })
      .from(student)
      .innerJoin(studentCareer, eq(studentCareer.id, student.carreraId))
      .where(
        and(eq(student.id, column), eq(studentCareer.facultadId, facultadId)),
      ),
  );
}

/**
 * The ONLY place a request scope becomes SQL (SR-6). The facultad of a request
 * is the facultad of the student's CURRENT career; `none` is a literal `false`.
 */
export function requestInScope(scope: RequestScope): SQL {
  switch (scope.kind) {
    case "facultad":
      return studentOfFacultad(solicitud.estudianteId, scope.facultadId);
    case "none":
      return sql`false`;
    default:
      return unhandled(scope);
  }
}

/**
 * The same facultad rule for an `Inscripcion` row, keyed on its student
 * (enrollment-administration, EA-SCOPE-1, CS-5).
 */
export function enrollmentInScope(scope: RequestScope): SQL {
  switch (scope.kind) {
    case "facultad":
      return studentOfFacultad(inscripcion.estudianteId, scope.facultadId);
    case "none":
      return sql`false`;
    default:
      return unhandled(scope);
  }
}

/**
 * The same facultad rule for a `Usuario` row, keyed on its own id: the student
 * search of the assign page (EA-CRE-1, CS-5).
 */
export function studentRowInScope(scope: RequestScope): SQL {
  switch (scope.kind) {
    case "facultad":
      return studentOfFacultad(usuario.id, scope.facultadId);
    case "none":
      return sql`false`;
    default:
      return unhandled(scope);
  }
}

/** One request by id, inside the scope. Zero rows means "not found". */
export function requestRowInScope(scope: RequestScope, id: number): SQL {
  return and(eq(solicitud.id, id), requestInScope(scope)) as SQL;
}

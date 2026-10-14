import "server-only";

import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { carrera, solicitud, usuario } from "@/db/schema";
import type { RequestScope } from "@/lib/intake/request-scope";

const qb = new QueryBuilder();
const student = alias(usuario, "e");
const studentCareer = alias(carrera, "c");

function unhandled(scope: never): never {
  throw new Error(`Unhandled request scope: ${JSON.stringify(scope)}`);
}

/**
 * The ONLY place a request scope becomes SQL (SR-6). The facultad of a request
 * is the facultad of the student's CURRENT career (`Usuario.CarreraId ->
 * Carrera.FacultadId`); the snapshot career name is never used. The inner join
 * makes a student without a career invisible, and `none` is a literal `false`.
 */
export function requestInScope(scope: RequestScope): SQL {
  switch (scope.kind) {
    case "facultad":
      return exists(
        qb
          .select({ one: sql`1` })
          .from(student)
          .innerJoin(studentCareer, eq(studentCareer.id, student.carreraId))
          .where(
            and(
              eq(student.id, solicitud.estudianteId),
              eq(studentCareer.facultadId, scope.facultadId),
            ),
          ),
      );
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

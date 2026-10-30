import "server-only";

import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { escalamiento, solicitud, usuario } from "@/db/schema";
import type { CoordinationScope } from "@/lib/intake/coordination-scope";

const qb = new QueryBuilder();
// Aliased so the predicate also works inside a query that already joins the
// request or the student (the queue and detail reads do).
const escalatedRequest = alias(solicitud, "sc");
const student = alias(usuario, "ec");

function unhandled(scope: never): never {
  throw new Error(`Unhandled coordination scope: ${JSON.stringify(scope)}`);
}

/**
 * The ONLY place a coordination scope becomes SQL (ES-3, ES-9). The career of
 * an escalation is the CURRENT career of the request's student
 * (`Usuario.CarreraId`); the snapshot career name is never used and no career
 * is stored on the escalation. The inner join makes a student without a career
 * invisible, and `none` is a literal `false`.
 */
export function escalationInScope(scope: CoordinationScope): SQL {
  switch (scope.kind) {
    case "carrera":
      return exists(
        qb
          .select({ one: sql`1` })
          .from(escalatedRequest)
          .innerJoin(student, eq(student.id, escalatedRequest.estudianteId))
          .where(
            and(
              eq(escalatedRequest.id, escalamiento.solicitudId),
              eq(student.carreraId, scope.carreraId),
            ),
          ),
      );
    case "none":
      return sql`false`;
    default:
      return unhandled(scope);
  }
}

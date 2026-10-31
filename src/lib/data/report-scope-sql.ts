import "server-only";

import { and, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { grupo, solicitud, solicitudAsignatura, usuario } from "@/db/schema";
import type { EstadoSolicitud } from "@/lib/intake/states";
import type { ReportScope } from "@/lib/reports/scope";

const qb = new QueryBuilder();
const student = alias(usuario, "e");
// Distinct from the aliases the ranking queries join with (`g`, `sa`), so the
// filter EXISTS never shadows a join of the outer query.
const filterPair = alias(solicitudAsignatura, "fsa");
const filterGroup = alias(grupo, "fg");

function unhandled(scope: never): never {
  throw new Error(`Unhandled report scope: ${JSON.stringify(scope)}`);
}

/**
 * The ONLY place a report scope becomes SQL (CR-2). The career of a request is
 * the career of the student's CURRENT `Usuario.CarreraId`; the snapshot career
 * name is never used, and a student without a career matches nothing. `none` is
 * a literal `false`.
 */
export function reportInScope(scope: ReportScope): SQL {
  switch (scope.kind) {
    case "carrera":
      return exists(
        qb
          .select({ one: sql`1` })
          .from(student)
          .where(
            and(
              eq(student.id, solicitud.estudianteId),
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

/**
 * The period filter as ONE `EXISTS` over the request's pairs (CR-3): a request
 * belongs to a period when at least one of its pairs is in a group of it.
 * Omitted (`undefined`) when every period is wanted.
 */
export function classFilter(periodo: string | null): SQL | undefined {
  if (periodo === null) return undefined;
  return exists(
    qb
      .select({ one: sql`1` })
      .from(filterPair)
      .innerJoin(filterGroup, eq(filterGroup.id, filterPair.grupoId))
      .where(
        and(
          eq(filterPair.solicitudId, solicitud.id),
          eq(filterGroup.periodo, periodo),
        ),
      ),
  );
}

export type ReportFilters = {
  /** null = all periods. */
  periodo: string | null;
};

/**
 * The one where clause behind every report figure (CR-3). The scope is the
 * unconditional first term and filters only narrow it; the caller names the
 * states (rankings pass `RANKING_STATES`, period options `VISIBLE_STATES`).
 */
export function buildReportWhere(
  scope: ReportScope,
  filters: ReportFilters,
  states: readonly EstadoSolicitud[],
): SQL {
  return and(
    reportInScope(scope),
    inArray(solicitud.estado, [...states]),
    classFilter(filters.periodo),
  ) as SQL;
}

import "server-only";

import {
  and,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { grupo, solicitud, solicitudAsignatura, usuario } from "@/db/schema";
import { containsPattern } from "@/lib/data/sql-like";
import type { Causa } from "@/lib/intake/causes";
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
 * The period and teacher filters as ONE `EXISTS` over the request's pairs
 * (CR-3): a request belongs to a period when at least one of its pairs is in a
 * group of it, and to a teacher when at least one pair is in a group of theirs.
 * Both sit in the SAME `EXISTS`, so "teacher d in period p" means one class row
 * that satisfies both. Omitted (`undefined`) when neither is asked for.
 */
export function classFilter(
  periodo: string | null,
  docenteId?: number | null,
): SQL | undefined {
  const onGroup = [
    periodo === null ? undefined : eq(filterGroup.periodo, periodo),
    docenteId == null ? undefined : eq(filterGroup.docenteId, docenteId),
  ].filter((term): term is SQL => term !== undefined);
  if (onGroup.length === 0) return undefined;
  return exists(
    qb
      .select({ one: sql`1` })
      .from(filterPair)
      .innerJoin(filterGroup, eq(filterGroup.id, filterPair.grupoId))
      .where(and(eq(filterPair.solicitudId, solicitud.id), ...onGroup)),
  );
}

export type ReportFilters = {
  /** null = all periods. */
  periodo: string | null;
  /** A teacher id; one that owns no pair in scope matches nothing. */
  docenteId?: number | null;
  /** Contains-match on the snapshot student name or CIF; empty = no filter. */
  q?: string;
  causa?: Causa | null;
};

/** The student term: the snapshot name or the CIF (CR-3). */
function studentTerm(q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  return or(
    ilike(solicitud.estudianteNombre, containsPattern(q)),
    ilike(solicitud.estudianteCif, containsPattern(q)),
  );
}

/**
 * The one where clause behind every report figure (CR-3). The scope is the
 * unconditional first term and filters only narrow it; the caller names the
 * states (rankings pass `RANKING_STATES`, the detail and the period options
 * `VISIBLE_STATES`).
 */
export function buildReportWhere(
  scope: ReportScope,
  filters: ReportFilters,
  states: readonly EstadoSolicitud[],
): SQL {
  return and(
    reportInScope(scope),
    inArray(solicitud.estado, [...states]),
    classFilter(filters.periodo, filters.docenteId),
    studentTerm(filters.q),
    filters.causa ? eq(solicitud.causa, filters.causa) : undefined,
  ) as SQL;
}

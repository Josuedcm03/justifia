import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  asignatura,
  grupo,
  solicitud,
  solicitudAsignatura,
  usuario,
} from "@/db/schema";
import { buildReportWhere } from "@/lib/data/report-scope-sql";
import { PERIODO_RE } from "@/lib/import/normalize";
import { VISIBLE_STATES } from "@/lib/intake/states";
import { RANKING_LIMIT, RANKING_STATES } from "@/lib/reports/constants";
import type { PeriodFilter, ResolvedPeriod } from "@/lib/reports/params";
import type { ReportScope } from "@/lib/reports/scope";

// The three dashboard rankings and the period options (coordination-reports,
// CR-4, CR-5). Every query shares `buildReportWhere`; the aliases below never
// collide with the scope alias `e` nor the filter aliases `fsa`/`fg`.

/** What the queries need from `db`; a DB-free `QueryBuilder` satisfies it in tests. */
export type RankingSource = Pick<typeof db, "select" | "selectDistinct">;

const student = alias(usuario, "u");
const teacher = alias(usuario, "d");
const pair = alias(solicitudAsignatura, "sa");
const group = alias(grupo, "g");
const subject = alias(asignatura, "a");

/**
 * The period predicate on the JOINED group. The `EXISTS` of `buildReportWhere`
 * admits a request; this keeps a request that spans two periods from counting
 * its other-period classes for a teacher or a class.
 */
function groupPeriod(periodo: string | null) {
  return periodo === null ? undefined : eq(group.periodo, periodo);
}

function teacherPairs(source: RankingSource) {
  return source
    .select({ id: teacher.id, name: teacher.nombreCompleto, total: count() })
    .from(solicitud)
    .innerJoin(pair, eq(pair.solicitudId, solicitud.id))
    .innerJoin(group, eq(group.id, pair.grupoId))
    .innerJoin(teacher, eq(teacher.id, group.docenteId));
}

function classPairs(source: RankingSource) {
  return source
    .select({
      id: subject.id,
      codigo: subject.codigo,
      name: subject.nombre,
      total: count(),
    })
    .from(solicitud)
    .innerJoin(pair, eq(pair.solicitudId, solicitud.id))
    .innerJoin(group, eq(group.id, pair.grupoId))
    .innerJoin(subject, eq(subject.id, group.asignaturaId));
}

/** Students by number of requests (one row per request, no pair join). */
export function studentsRankingQuery(
  source: RankingSource,
  scope: ReportScope,
  periodo: string | null,
) {
  return source
    .select({
      id: student.id,
      name: student.nombreCompleto,
      cif: student.cif,
      total: count(),
    })
    .from(solicitud)
    .innerJoin(student, eq(student.id, solicitud.estudianteId))
    .where(buildReportWhere(scope, { periodo }, RANKING_STATES))
    .groupBy(student.id, student.nombreCompleto, student.cif)
    .orderBy(desc(count()), asc(student.nombreCompleto), asc(student.id))
    .limit(RANKING_LIMIT);
}

/** Teachers (the live `Grupo.DocenteId`) by number of justified classes. */
export function teachersRankingQuery(
  source: RankingSource,
  scope: ReportScope,
  periodo: string | null,
) {
  return teacherPairs(source)
    .where(
      and(
        buildReportWhere(scope, { periodo }, RANKING_STATES),
        groupPeriod(periodo),
      ),
    )
    .groupBy(teacher.id, teacher.nombreCompleto)
    .orderBy(desc(count()), asc(teacher.nombreCompleto), asc(teacher.id))
    .limit(RANKING_LIMIT);
}

/** Classes (asignaturas) by number of justified classes. */
export function classesRankingQuery(
  source: RankingSource,
  scope: ReportScope,
  periodo: string | null,
) {
  return classPairs(source)
    .where(
      and(
        buildReportWhere(scope, { periodo }, RANKING_STATES),
        groupPeriod(periodo),
      ),
    )
    .groupBy(subject.id, subject.codigo, subject.nombre)
    .orderBy(desc(count()), asc(subject.nombre), asc(subject.id))
    .limit(RANKING_LIMIT);
}

/** Distinct periods of the in-scope requests of every visible state. */
export function periodsQuery(source: RankingSource, scope: ReportScope) {
  return source
    .selectDistinct({ periodo: group.periodo })
    .from(solicitud)
    .innerJoin(pair, eq(pair.solicitudId, solicitud.id))
    .innerJoin(group, eq(group.id, pair.grupoId))
    .where(buildReportWhere(scope, { periodo: null }, VISIBLE_STATES))
    .orderBy(desc(group.periodo));
}

/**
 * Periods with in-scope requests, newest first (`AAAA-S1/S2` sorts correctly as
 * text). A code that does not match `PERIODO_RE` is dropped, so the selector can
 * only offer values the parser would accept back.
 */
export async function listReportPeriods(scope: ReportScope): Promise<string[]> {
  const rows = await periodsQuery(db, scope);
  return rows.map((row) => row.periodo).filter((p) => PERIODO_RE.test(p));
}

export type RankingEntry = { id: number; name: string; total: number };
export type StudentEntry = RankingEntry & { cif: string | null };
export type ClassEntry = RankingEntry & { codigo: string };

export type DashboardRankings = {
  estudiantes: StudentEntry[];
  docentes: RankingEntry[];
  asignaturas: ClassEntry[];
};

export type ReportDashboard = {
  /** Periods with in-scope requests, newest first. */
  periods: string[];
  /** The period the rankings use; null when there is no data at all. */
  periodo: ResolvedPeriod | null;
  rankings: DashboardRankings;
  degraded: boolean;
};

const NO_RANKINGS: DashboardRankings = {
  estudiantes: [],
  docentes: [],
  asignaturas: [],
};

/** `latest` is the newest period; an absent well-formed code is applied as is. */
function resolvePeriod(
  requested: PeriodFilter,
  periods: readonly string[],
): ResolvedPeriod | null {
  if (periods.length === 0) return null;
  if (requested.kind === "latest") return { kind: "code", periodo: periods[0] };
  return requested;
}

/**
 * The dashboard read (CR-8). All-or-nothing: the periods first (to resolve
 * `latest`), then the three rankings together, inside one `try`. Any failure is
 * `degraded` with no partial figures, never a thrown error.
 */
export async function loadReportDashboard(
  scope: ReportScope,
  requested: PeriodFilter,
): Promise<ReportDashboard> {
  try {
    const periods = await listReportPeriods(scope);
    const periodo = resolvePeriod(requested, periods);
    if (periodo === null) {
      return { periods, periodo, rankings: NO_RANKINGS, degraded: false };
    }
    const code = periodo.kind === "code" ? periodo.periodo : null;
    const [estudiantes, docentes, asignaturas] = await Promise.all([
      studentsRankingQuery(db, scope, code),
      teachersRankingQuery(db, scope, code),
      classesRankingQuery(db, scope, code),
    ]);
    return {
      periods,
      periodo,
      rankings: { estudiantes, docentes, asignaturas },
      degraded: false,
    };
  } catch {
    return {
      periods: [],
      periodo: null,
      rankings: NO_RANKINGS,
      degraded: true,
    };
  }
}

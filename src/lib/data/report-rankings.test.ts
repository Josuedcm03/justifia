// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect, QueryBuilder } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import {
  classesRankingQuery,
  listReportPeriods,
  loadReportDashboard,
  periodsQuery,
  studentsRankingQuery,
  teachersRankingQuery,
  type RankingSource,
} from "@/lib/data/report-rankings";
import { VISIBLE_STATES } from "@/lib/intake/states";
import type { ReportScope } from "@/lib/reports/scope";

// A DB-free builder: `toSQL()` needs no connection (pattern of users-query).
const source = new QueryBuilder() as unknown as RankingSource;
const CARRERA: ReportScope = { kind: "carrera", carreraId: 7 };

function toSql(query: { toSQL(): { sql: string; params: unknown[] } }) {
  return query.toSQL();
}

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

const ORDER = (name: string, id: string) =>
  `order by count(*) desc, ${name} asc, ${id} asc limit $`;

describe("ranking SQL (CR-4, CR-RANK-1..3)", () => {
  it("students: one count per request, grouped by the student", () => {
    const { sql, params } = toSql(
      studentsRankingQuery(source, CARRERA, "2026-S1"),
    );

    expect(sql).toContain(
      'inner join "Usuario" "u" on "u"."Id" = "Solicitud"."EstudianteId"',
    );
    expect(sql).toContain('group by "u"."Id", "u"."NombreCompleto", "u"."Cif"');
    expect(sql).toContain(ORDER('"u"."NombreCompleto"', '"u"."Id"'));
    expect(params.at(-1)).toBe(10);
  });

  it("teachers: pairs grouped by the live Grupo.DocenteId", () => {
    const { sql } = toSql(teachersRankingQuery(source, CARRERA, "2026-S1"));

    expect(sql).toContain('inner join "SolicitudAsignatura" "sa"');
    expect(sql).toContain('inner join "Grupo" "g"');
    expect(sql).toContain(
      'inner join "Usuario" "d" on "d"."Id" = "g"."DocenteId"',
    );
    expect(sql).toContain('group by "d"."Id", "d"."NombreCompleto"');
    expect(sql).toContain(ORDER('"d"."NombreCompleto"', '"d"."Id"'));
  });

  it("classes: pairs grouped by the asignatura of the group", () => {
    const { sql } = toSql(classesRankingQuery(source, CARRERA, "2026-S1"));

    expect(sql).toContain(
      'inner join "Asignatura" "a" on "a"."Id" = "g"."AsignaturaId"',
    );
    expect(sql).toContain('group by "a"."Id", "a"."Codigo", "a"."Nombre"');
    expect(sql).toContain(ORDER('"a"."Nombre"', '"a"."Id"'));
  });

  it.each([
    ["students", studentsRankingQuery],
    ["teachers", teachersRankingQuery],
    ["classes", classesRankingQuery],
  ] as const)(
    "%s count only aprobada and pendiente, in the career scope",
    (_n, build) => {
      const { sql, params } = toSql(build(source, CARRERA, null));

      expect(params.slice(0, 3)).toEqual([7, "aprobada", "pendiente"]);
      expect(sql.match(/from "Usuario" "e"/g)).toHaveLength(1);
    },
  );

  it("pair rankings keep the other-period pairs of a request out", () => {
    for (const build of [teachersRankingQuery, classesRankingQuery]) {
      const withPeriod = toSql(build(source, CARRERA, "2026-S1"));
      const all = toSql(build(source, CARRERA, null));

      // The EXISTS admits the request; the join predicate limits the pairs.
      expect(withPeriod.params).toEqual([
        7,
        "aprobada",
        "pendiente",
        "2026-S1",
        "2026-S1",
        10,
      ]);
      expect(withPeriod.sql).toContain('"g"."Periodo" = $');
      expect(all.sql).not.toContain('"g"."Periodo"');
    }
  });

  it("the student ranking needs no joined-period predicate (requests, not pairs)", () => {
    const { sql } = toSql(studentsRankingQuery(source, CARRERA, "2026-S1"));

    expect(sql).not.toContain('"g"."Periodo"');
  });
});

describe("listReportPeriods (CR-5)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("is a DISTINCT, newest-first list over every visible state", () => {
    const { sql, params } = toSql(periodsQuery(source, CARRERA));

    expect(sql).toMatch(/^select distinct "g"\."Periodo" from "Solicitud"/);
    expect(sql).toContain('order by "g"."Periodo" desc');
    expect(params).toEqual([7, ...VISIBLE_STATES]);
  });

  it("keeps only well-formed codes, in the order read", async () => {
    use([
      {
        kind: "select",
        rows: [
          { periodo: "2026-S2" },
          { periodo: "2026-s1" },
          { periodo: "2025-S1" },
          { periodo: "legacy" },
        ],
      },
    ]);

    expect(await listReportPeriods(CARRERA)).toEqual(["2026-S2", "2025-S1"]);
  });
});

describe("loadReportDashboard (CR-5, CR-8: fail-soft)", () => {
  const dialect = new PgDialect();
  const STUDENTS = [{ id: 1, name: "Ana Perez", cif: "20-001", total: 3 }];
  const TEACHERS = [{ id: 9, name: "Luis Gomez", total: 2 }];
  const CLASSES = [{ id: 5, codigo: "MAT-1", name: "Calculo", total: 2 }];
  const PERIODS: Step = {
    kind: "select",
    rows: [{ periodo: "2026-S2" }, { periodo: "2026-S1" }],
  };
  const RANKINGS: Step[] = [
    { kind: "select", rows: STUDENTS },
    { kind: "select", rows: TEACHERS },
    { kind: "select", rows: CLASSES },
  ];

  /** The bound parameters of the where clause of one logged statement. */
  const whereParams = (double: ReturnType<typeof use>, at: number) =>
    dialect.sqlToQuery(double.log[at].where as SQL).params;

  beforeEach(() => {
    holder.current = null;
  });

  it("resolves latest to the newest period and ranks it", async () => {
    const double = use([PERIODS, ...RANKINGS]);

    const result = await loadReportDashboard(CARRERA, { kind: "latest" });

    expect(result).toEqual({
      periods: ["2026-S2", "2026-S1"],
      periodo: { kind: "code", periodo: "2026-S2" },
      rankings: {
        estudiantes: STUDENTS,
        docentes: TEACHERS,
        asignaturas: CLASSES,
      },
      degraded: false,
    });
    for (const at of [1, 2, 3])
      expect(whereParams(double, at)).toContain("2026-S2");
  });

  it("ranks every period for all, without a period predicate", async () => {
    const double = use([PERIODS, ...RANKINGS]);

    const result = await loadReportDashboard(CARRERA, { kind: "all" });

    expect(result.periodo).toEqual({ kind: "all" });
    for (const at of [1, 2, 3]) {
      expect(whereParams(double, at)).toEqual([7, "aprobada", "pendiente"]);
    }
  });

  it("applies a well-formed code absent from the options (zero rows, nothing leaked)", async () => {
    const double = use([
      PERIODS,
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    const result = await loadReportDashboard(CARRERA, {
      kind: "code",
      periodo: "2020-S1",
    });

    expect(result.periodo).toEqual({ kind: "code", periodo: "2020-S1" });
    expect(result.rankings).toEqual({
      estudiantes: [],
      docentes: [],
      asignaturas: [],
    });
    expect(whereParams(double, 1)).toContain("2020-S1");
  });

  it.each([{ kind: "latest" }, { kind: "all" }] as const)(
    "reports no period and runs no ranking when there is no data (%o)",
    async (period) => {
      const double = use([{ kind: "select", rows: [] }]);

      const result = await loadReportDashboard(CARRERA, period);

      expect(result).toEqual({
        periods: [],
        periodo: null,
        rankings: { estudiantes: [], docentes: [], asignaturas: [] },
        degraded: false,
      });
      expect(double.log).toHaveLength(1);
    },
  );

  it.each([
    ["the periods", 0],
    ["the students ranking", 1],
    ["the teachers ranking", 2],
    ["the classes ranking", 3],
  ])(
    "is degraded with no partial data when %s fails",
    async (_name, failing) => {
      const script = [PERIODS, ...RANKINGS].map((step, at) =>
        at === failing ? { ...step, error: new Error("db down") } : step,
      );
      use(script);

      const result = await loadReportDashboard(CARRERA, { kind: "latest" });

      expect(result).toEqual({
        periods: [],
        periodo: null,
        rankings: { estudiantes: [], docentes: [], asignaturas: [] },
        degraded: true,
      });
    },
  );
});
